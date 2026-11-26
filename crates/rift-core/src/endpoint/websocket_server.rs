use serde::{Deserialize, Serialize};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{
    Callback, ErrorResponse, Request, Response,
};
use tokio_tungstenite::tungstenite::http::StatusCode;

use super::link::{Context, Link, PeerWrites, WriteRequest};
use super::message_format::MessageFormat;
use super::message_stream::{pump_messages, to_io};
use crate::event::ConnectionState;

const BROADCAST_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebSocketServerConfig {
    pub bind: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub max_clients: Option<usize>,
    #[serde(flatten)]
    pub message: MessageFormat,
}

impl WebSocketServerConfig {
    pub fn new(bind: String) -> Self {
        Self {
            bind,
            path: None,
            max_clients: None,
            message: MessageFormat::default(),
        }
    }

    fn is_full(&self, context: &Context) -> bool {
        self.max_clients
            .is_some_and(|limit| context.peers.count() >= limit)
    }

    fn accepts_path(&self, path: &str) -> bool {
        self.path
            .as_deref()
            .is_none_or(|expected| expected.trim_end_matches('/') == path.trim_end_matches('/'))
    }
}

struct PathCheck<'a>(&'a WebSocketServerConfig);

impl Callback for PathCheck<'_> {
    fn on_request(self, request: &Request, response: Response) -> Result<Response, ErrorResponse> {
        if self.0.accepts_path(request.uri().path()) {
            return Ok(response);
        }
        let mut rejection = ErrorResponse::new(Some("unknown path".into()));
        *rejection.status_mut() = StatusCode::NOT_FOUND;
        Err(rejection)
    }
}

pub(crate) async fn run(config: WebSocketServerConfig, link: Link) {
    let Link {
        mut writes,
        context,
    } = link;
    let listener = match TcpListener::bind(&config.bind).await {
        Ok(listener) => listener,
        Err(error) => return context.report_error(error).await,
    };
    context.report(ConnectionState::Listening).await;
    let (broadcaster, _) = broadcast::channel::<WriteRequest>(BROADCAST_CAPACITY);
    loop {
        tokio::select! {
            _ = context.cancel.cancelled() => return,
            accepted = listener.accept() => match accepted {
                Ok((stream, peer)) if config.is_full(&context) => {
                    context.report_error(format!("max clients reached, rejected {peer}")).await;
                    drop(stream);
                }
                Ok((stream, peer)) => {
                    let _ = stream.set_nodelay(true);
                    tokio::spawn(serve_client(
                        stream,
                        peer.to_string(),
                        config.clone(),
                        context.clone(),
                        broadcaster.subscribe(),
                    ));
                }
                Err(error) => context.report_error(error).await,
            },
            outgoing = writes.recv() => match outgoing {
                Some(bytes) => {
                    let _ = broadcaster.send(bytes);
                }
                None => return,
            },
        }
    }
}

async fn serve_client(
    stream: TcpStream,
    peer: String,
    config: WebSocketServerConfig,
    context: Context,
    writes: broadcast::Receiver<WriteRequest>,
) {
    let socket = match accept_hdr_async(stream, PathCheck(&config)).await {
        Ok(socket) => socket,
        Err(error) => {
            return context
                .report_error(format!("handshake with {peer} failed: {}", to_io(error)))
                .await
        }
    };
    let mut writes = PeerWrites::new(writes, peer.clone());
    context.peers.joined();
    context
        .report(ConnectionState::Connected { peer: peer.clone() })
        .await;
    let result = pump_messages(socket, &config.message, &context, &mut writes).await;
    context.peers.left();
    if let Err(error) = result {
        context.report_error(error).await;
    }
    context
        .report(ConnectionState::Disconnected { peer: Some(peer) })
        .await;
    if !context.peers.is_connected() && !context.cancel.is_cancelled() {
        context.report(ConnectionState::Listening).await;
    }
}
