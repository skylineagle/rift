use serde::{Deserialize, Serialize};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;

use super::link::{Context, Link, PeerWrites, WriteRequest};
use super::stream::pump;
use super::tcp_client::default_no_delay;
use crate::event::ConnectionState;

const BROADCAST_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TcpServerConfig {
    pub bind: String,
    #[serde(default)]
    pub max_clients: Option<usize>,
    #[serde(default = "default_no_delay")]
    pub no_delay: bool,
}

impl TcpServerConfig {
    pub fn new(bind: String) -> Self {
        Self {
            bind,
            max_clients: None,
            no_delay: default_no_delay(),
        }
    }

    fn is_full(&self, context: &Context) -> bool {
        self.max_clients
            .is_some_and(|limit| context.peers.count() >= limit)
    }
}

pub(crate) async fn run(config: TcpServerConfig, link: Link) {
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
                    let _ = stream.set_nodelay(config.no_delay);
                    context.peers.joined();
                    tokio::spawn(serve_client(
                        stream,
                        peer.to_string(),
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
    context: Context,
    writes: broadcast::Receiver<WriteRequest>,
) {
    let mut writes = PeerWrites::new(writes, peer.clone());
    context
        .report(ConnectionState::Connected { peer: peer.clone() })
        .await;
    let result = pump(stream, &context, &mut writes).await;
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
