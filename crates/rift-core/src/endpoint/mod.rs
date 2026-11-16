mod backoff;
mod client_session;
pub(crate) mod link;
mod stream;
mod tcp_client;
mod tcp_server;
mod uart;
mod udp_client;
mod udp_server;

use serde::{Deserialize, Serialize};

use link::Link;

pub use tcp_client::TcpClientConfig;
pub use tcp_server::TcpServerConfig;
pub use uart::{FlowControl, Parity, UartConfig};
pub use udp_client::UdpClientConfig;
pub use udp_server::{ReplyTo, UdpServerConfig};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Endpoint {
    TcpClient(TcpClientConfig),
    TcpServer(TcpServerConfig),
    UdpClient(UdpClientConfig),
    UdpServer(UdpServerConfig),
    Uart(UartConfig),
}

pub(crate) async fn run(endpoint: Endpoint, link: Link) {
    match endpoint {
        Endpoint::TcpClient(config) => tcp_client::run(config, link).await,
        Endpoint::TcpServer(config) => tcp_server::run(config, link).await,
        Endpoint::UdpClient(config) => udp_client::run(config, link).await,
        Endpoint::UdpServer(config) => udp_server::run(config, link).await,
        Endpoint::Uart(config) => uart::run(config, link).await,
    }
}
