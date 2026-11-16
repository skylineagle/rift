use std::io;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio::time::timeout;

use super::client_session::run_client;
use super::link::Link;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TcpClientConfig {
    pub address: String,
    #[serde(default = "default_reconnect_delay_ms")]
    pub reconnect_delay_ms: u64,
    #[serde(default = "default_connect_timeout_ms")]
    pub connect_timeout_ms: u64,
    #[serde(default = "default_no_delay")]
    pub no_delay: bool,
}

impl TcpClientConfig {
    pub fn new(address: String) -> Self {
        Self {
            address,
            reconnect_delay_ms: default_reconnect_delay_ms(),
            connect_timeout_ms: default_connect_timeout_ms(),
            no_delay: default_no_delay(),
        }
    }
}

pub(crate) fn default_reconnect_delay_ms() -> u64 {
    1000
}

pub(crate) fn default_connect_timeout_ms() -> u64 {
    5000
}

pub(crate) fn default_no_delay() -> bool {
    true
}

pub(crate) async fn run(config: TcpClientConfig, link: Link) {
    let reconnect_delay = Duration::from_millis(config.reconnect_delay_ms);
    run_client(config.address.clone(), link, reconnect_delay, || {
        connect(&config)
    })
    .await;
}

async fn connect(config: &TcpClientConfig) -> io::Result<TcpStream> {
    let limit = Duration::from_millis(config.connect_timeout_ms);
    let stream = timeout(limit, TcpStream::connect(&config.address))
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "connect timed out"))??;
    stream.set_nodelay(config.no_delay)?;
    Ok(stream)
}
