use std::io;
use std::net::SocketAddr;

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::net::{lookup_host, UdpSocket};

use super::link::Link;
use crate::event::ConnectionState;

const DATAGRAM_SIZE: usize = 65535;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UdpClientConfig {
    pub remote: String,
    #[serde(default)]
    pub bind: Option<String>,
}

pub(crate) async fn run(config: UdpClientConfig, link: Link) {
    let Link {
        mut writes,
        context,
    } = link;
    let socket = match open_socket(&config).await {
        Ok(socket) => socket,
        Err(error) => return context.report_error(error).await,
    };
    context.peers.joined();
    context
        .report(ConnectionState::Connected {
            peer: config.remote.clone(),
        })
        .await;
    let mut buffer = vec![0u8; DATAGRAM_SIZE];
    loop {
        tokio::select! {
            _ = context.cancel.cancelled() => break,
            received = socket.recv(&mut buffer) => match received {
                Ok(count) => {
                    if !context.forward(Bytes::copy_from_slice(&buffer[..count])).await {
                        break;
                    }
                }
                Err(error) => context.report_error(error).await,
            },
            outgoing = writes.recv() => match outgoing {
                Some(request) => {
                    match socket.send(&request.bytes).await {
                        Ok(_) => request.delivered(),
                        Err(error) => context.report_error(error).await,
                    }
                }
                None => break,
            },
        }
    }
    context.peers.left();
}

async fn open_socket(config: &UdpClientConfig) -> io::Result<UdpSocket> {
    let remote = resolve(&config.remote).await?;
    let bind = config.bind.clone().unwrap_or_else(|| {
        if remote.is_ipv4() {
            "0.0.0.0:0"
        } else {
            "[::]:0"
        }
        .to_string()
    });
    let socket = UdpSocket::bind(bind).await?;
    socket.connect(remote).await?;
    Ok(socket)
}

async fn resolve(remote: &str) -> io::Result<SocketAddr> {
    lookup_host(remote).await?.next().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::NotFound,
            format!("cannot resolve `{remote}`"),
        )
    })
}
