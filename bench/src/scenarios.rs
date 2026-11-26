use std::time::Duration;

use crate::case::{CaseConfig, Direction, LogMode};
use crate::kind::Kind;

pub struct Scenario {
    pub name: &'static str,
    a: Kind,
    b: Kind,
    direction: Direction,
    frame_size: usize,
    rate_mbps: Option<f64>,
}

pub const SCENARIOS: [Scenario; 4] = [
    Scenario {
        name: "tcp 1 KiB a-to-b",
        a: Kind::TcpServer,
        b: Kind::TcpClient,
        direction: Direction::AToB,
        frame_size: 1024,
        rate_mbps: None,
    },
    Scenario {
        name: "tcp 64 B a-to-b",
        a: Kind::TcpServer,
        b: Kind::TcpClient,
        direction: Direction::AToB,
        frame_size: 64,
        rate_mbps: None,
    },
    Scenario {
        name: "tcp 1 KiB both",
        a: Kind::TcpServer,
        b: Kind::TcpClient,
        direction: Direction::Both,
        frame_size: 1024,
        rate_mbps: None,
    },
    Scenario {
        name: "udp 1400 B a-to-b at 50 MB/s",
        a: Kind::UdpServer,
        b: Kind::UdpClient,
        direction: Direction::AToB,
        frame_size: 1400,
        rate_mbps: Some(50.0),
    },
];

impl Scenario {
    pub fn config(&self, duration: Duration) -> CaseConfig {
        CaseConfig {
            a: self.a,
            b: self.b,
            direction: self.direction,
            frame_size: self.frame_size,
            rate_mbps: self.rate_mbps,
            duration,
            log: LogMode::Quiet,
        }
    }
}
