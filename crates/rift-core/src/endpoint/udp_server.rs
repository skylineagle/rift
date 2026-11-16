use std::collections::HashMap;
use std::fmt;
use std::net::SocketAddr;
use std::str::FromStr;
use std::time::Duration;

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::net::UdpSocket;
use tokio::time::{interval, Instant};

use super::link::{Context, Link};
use crate::error::Error;
use crate::event::ConnectionState;

const DATAGRAM_SIZE: usize = 65535;
const SWEEP_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReplyTo {
    #[default]
    All,
    Last,
}

impl fmt::Display for ReplyTo {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            ReplyTo::All => "all",
            ReplyTo::Last => "last",
        })
    }
}

impl FromStr for ReplyTo {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self, Error> {
        match input {
            "all" => Ok(ReplyTo::All),
            "last" => Ok(ReplyTo::Last),
            other => Err(Error::InvalidUri(format!("unknown reply_to `{other}`"))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UdpServerConfig {
    pub bind: String,
    #[serde(default)]
    pub reply_to: ReplyTo,
    #[serde(default)]
    pub peer_timeout_secs: Option<u64>,
}

impl UdpServerConfig {
    pub fn new(bind: String) -> Self {
        Self {
            bind,
            reply_to: ReplyTo::default(),
            peer_timeout_secs: None,
        }
    }
}

#[derive(Default)]
struct Peers {
    last_seen: HashMap<SocketAddr, Instant>,
    last: Option<SocketAddr>,
}

impl Peers {
    fn heard(&mut self, peer: SocketAddr) -> bool {
        self.last = Some(peer);
        self.last_seen.insert(peer, Instant::now()).is_none()
    }

    fn recipients(&self, reply_to: ReplyTo) -> Vec<SocketAddr> {
        match reply_to {
            ReplyTo::All => self.last_seen.keys().copied().collect(),
            ReplyTo::Last => self.last.into_iter().collect(),
        }
    }

    fn expire(&mut self, timeout: Duration) -> Vec<SocketAddr> {
        let expired: Vec<SocketAddr> = self
            .last_seen
            .iter()
            .filter(|(_, seen)| seen.elapsed() > timeout)
            .map(|(peer, _)| *peer)
            .collect();
        for peer in &expired {
            self.last_seen.remove(peer);
            if self.last == Some(*peer) {
                self.last = None;
            }
        }
        expired
    }
}

pub(crate) async fn run(config: UdpServerConfig, link: Link) {
    let Link {
        mut writes,
        context,
    } = link;
    let socket = match UdpSocket::bind(&config.bind).await {
        Ok(socket) => socket,
        Err(error) => return context.report_error(error).await,
    };
    context.report(ConnectionState::Listening).await;
    let mut peers = Peers::default();
    let mut sweep = interval(SWEEP_INTERVAL);
    let mut buffer = vec![0u8; DATAGRAM_SIZE];
    loop {
        tokio::select! {
            _ = context.cancel.cancelled() => return,
            received = socket.recv_from(&mut buffer) => match received {
                Ok((count, peer)) => {
                    if peers.heard(peer) {
                        context.peers.joined();
                        context
                            .report(ConnectionState::Connected { peer: peer.to_string() })
                            .await;
                    }
                    if !context.forward(Bytes::copy_from_slice(&buffer[..count])).await {
                        return;
                    }
                }
                Err(error) => context.report_error(error).await,
            },
            outgoing = writes.recv() => match outgoing {
                Some(request) => {
                    for peer in peers.recipients(config.reply_to) {
                        match socket.send_to(&request.bytes, peer).await {
                            Ok(_) => request.delivered(),
                            Err(error) => context.report_error(error).await,
                        }
                    }
                }
                None => return,
            },
            _ = sweep.tick(), if config.peer_timeout_secs.is_some() => {
                forget_silent_peers(&mut peers, &config, &context).await;
            }
        }
    }
}

async fn forget_silent_peers(peers: &mut Peers, config: &UdpServerConfig, context: &Context) {
    let Some(seconds) = config.peer_timeout_secs else {
        return;
    };
    let expired = peers.expire(Duration::from_secs(seconds));
    for peer in &expired {
        context.peers.left();
        context
            .report(ConnectionState::Disconnected {
                peer: Some(peer.to_string()),
            })
            .await;
    }
    if !expired.is_empty() && !context.peers.is_connected() {
        context.report(ConnectionState::Listening).await;
    }
}
