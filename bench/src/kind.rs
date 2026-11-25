use clap::ValueEnum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    TcpServer,
    TcpClient,
    UdpServer,
    UdpClient,
    Uart,
}

pub const ALL_KINDS: [Kind; 5] = [
    Kind::TcpServer,
    Kind::TcpClient,
    Kind::UdpServer,
    Kind::UdpClient,
    Kind::Uart,
];

impl Kind {
    pub fn label(self) -> &'static str {
        match self {
            Kind::TcpServer => "tcp-server",
            Kind::TcpClient => "tcp-client",
            Kind::UdpServer => "udp-server",
            Kind::UdpClient => "udp-client",
            Kind::Uart => "uart",
        }
    }

}

pub fn pairs() -> Vec<(Kind, Kind)> {
    let mut pairs = Vec::new();
    for (index, first) in ALL_KINDS.iter().enumerate() {
        for second in &ALL_KINDS[index..] {
            pairs.push((*first, *second));
        }
    }
    pairs
}
