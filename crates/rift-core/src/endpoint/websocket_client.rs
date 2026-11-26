use std::io;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::time::timeout;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use super::client_session::{run_session_client, Session};
use super::link::{Context, Link, WriteRequest};
use super::message_format::MessageFormat;
use super::message_stream::{pump_messages, to_io};
use super::tcp_client::{default_connect_timeout_ms, default_reconnect_delay_ms};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WebSocketClientConfig {
    pub url: String,
    #[serde(default = "default_reconnect_delay_ms")]
    pub reconnect_delay_ms: u64,
    #[serde(default = "default_connect_timeout_ms")]
    pub connect_timeout_ms: u64,
    #[serde(flatten)]
    pub message: MessageFormat,
}

impl WebSocketClientConfig {
    pub fn new(url: String) -> Self {
        Self {
            url,
            reconnect_delay_ms: default_reconnect_delay_ms(),
            connect_timeout_ms: default_connect_timeout_ms(),
            message: MessageFormat::default(),
        }
    }
}

struct WebSocketSession<'a> {
    socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
    message: &'a MessageFormat,
}

impl Session for WebSocketSession<'_> {
    async fn serve(
        self,
        context: &Context,
        writes: &mut mpsc::Receiver<WriteRequest>,
    ) -> io::Result<()> {
        pump_messages(self.socket, self.message, context, writes).await
    }
}

pub(crate) async fn run(config: WebSocketClientConfig, link: Link) {
    let reconnect_delay = Duration::from_millis(config.reconnect_delay_ms);
    run_session_client(config.url.clone(), link, reconnect_delay, || {
        connect(&config)
    })
    .await;
}

async fn connect(config: &WebSocketClientConfig) -> io::Result<WebSocketSession<'_>> {
    let limit = Duration::from_millis(config.connect_timeout_ms);
    let (socket, _) = timeout(limit, connect_async(config.url.as_str()))
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "connect timed out"))?
        .map_err(to_io)?;
    if let MaybeTlsStream::Plain(stream) = socket.get_ref() {
        stream.set_nodelay(true)?;
    }
    Ok(WebSocketSession {
        socket,
        message: &config.message,
    })
}
