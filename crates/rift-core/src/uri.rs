use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;

use crate::endpoint::{
    Endpoint, ReplyTo, TcpClientConfig, TcpServerConfig, UartConfig, UdpClientConfig,
    UdpServerConfig,
};
use crate::error::{Error, Result};
use crate::side_config::SideConfig;

fn invalid(message: impl Into<String>) -> Error {
    Error::InvalidUri(message.into())
}

struct Options(HashMap<String, String>);

impl Options {
    fn parse(query: &str) -> Result<Self> {
        let mut options = HashMap::new();
        for pair in query.split('&').filter(|pair| !pair.is_empty()) {
            let (key, value) = pair
                .split_once('=')
                .ok_or_else(|| invalid(format!("option `{pair}` needs a value")))?;
            options.insert(key.to_string(), value.to_string());
        }
        Ok(Self(options))
    }

    fn take(&mut self, key: &str) -> Option<String> {
        self.0.remove(key)
    }

    fn take_parsed<T: FromStr>(&mut self, key: &str, default: T) -> Result<T> {
        match self.take(key) {
            Some(value) => value
                .parse()
                .map_err(|_| invalid(format!("invalid value `{value}` for `{key}`"))),
            None => Ok(default),
        }
    }

    fn take_optional<T: FromStr>(&mut self, key: &str) -> Result<Option<T>> {
        self.take(key)
            .map(|value| {
                value
                    .parse()
                    .map_err(|_| invalid(format!("invalid value `{value}` for `{key}`")))
            })
            .transpose()
    }

    fn finish(self) -> Result<()> {
        match self.0.into_keys().next() {
            Some(key) => Err(invalid(format!("unknown option `{key}`"))),
            None => Ok(()),
        }
    }
}

fn require_location(location: &str) -> Result<String> {
    if location.is_empty() {
        Err(invalid("missing address"))
    } else {
        Ok(location.to_string())
    }
}

fn parse_uart(location: &str, options: &mut Options) -> Result<UartConfig> {
    let baud_rate = options
        .take("baud")
        .ok_or_else(|| invalid("uart needs `baud`"))?
        .parse()
        .map_err(|_| invalid("invalid `baud`"))?;
    let data_bits: u8 = options.take_parsed("data_bits", 8)?;
    let stop_bits: u8 = options.take_parsed("stop_bits", 1)?;
    if !(5..=8).contains(&data_bits) {
        return Err(invalid("data_bits must be 5-8"));
    }
    if !(1..=2).contains(&stop_bits) {
        return Err(invalid("stop_bits must be 1 or 2"));
    }
    Ok(UartConfig {
        port: require_location(location)?,
        baud_rate,
        data_bits,
        parity: options.take_parsed("parity", Default::default())?,
        stop_bits,
        flow_control: options.take_parsed("flow", Default::default())?,
    })
}

fn parse_tcp_client(location: &str, options: &mut Options) -> Result<TcpClientConfig> {
    let defaults = TcpClientConfig::new(require_location(location)?);
    Ok(TcpClientConfig {
        reconnect_delay_ms: options
            .take_parsed("reconnect_delay_ms", defaults.reconnect_delay_ms)?,
        connect_timeout_ms: options
            .take_parsed("connect_timeout_ms", defaults.connect_timeout_ms)?,
        no_delay: options.take_parsed("no_delay", defaults.no_delay)?,
        ..defaults
    })
}

fn parse_tcp_server(location: &str, options: &mut Options) -> Result<TcpServerConfig> {
    let defaults = TcpServerConfig::new(require_location(location)?);
    Ok(TcpServerConfig {
        max_clients: options.take_optional("max_clients")?,
        no_delay: options.take_parsed("no_delay", defaults.no_delay)?,
        ..defaults
    })
}

fn parse_udp_server(location: &str, options: &mut Options) -> Result<UdpServerConfig> {
    Ok(UdpServerConfig {
        reply_to: options.take_parsed("reply_to", Default::default())?,
        peer_timeout_secs: options.take_optional("peer_timeout_secs")?,
        ..UdpServerConfig::new(require_location(location)?)
    })
}

fn split_uri(input: &str) -> Result<(&str, &str, Options)> {
    let (scheme, rest) = input
        .split_once("://")
        .ok_or_else(|| invalid(format!("`{input}` is missing a scheme")))?;
    let (location, query) = rest.split_once('?').unwrap_or((rest, ""));
    Ok((scheme, location, Options::parse(query)?))
}

fn build_endpoint(scheme: &str, location: &str, options: &mut Options) -> Result<Endpoint> {
    Ok(match scheme {
        "tcp" => Endpoint::TcpClient(parse_tcp_client(location, options)?),
        "tcp-server" => Endpoint::TcpServer(parse_tcp_server(location, options)?),
        "udp" => Endpoint::UdpClient(UdpClientConfig {
            remote: require_location(location)?,
            bind: options.take("bind"),
        }),
        "udp-server" => Endpoint::UdpServer(parse_udp_server(location, options)?),
        "uart" => Endpoint::Uart(parse_uart(location, options)?),
        other => return Err(invalid(format!("unknown scheme `{other}`"))),
    })
}

impl FromStr for Endpoint {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self> {
        let (scheme, location, mut options) = split_uri(input)?;
        let endpoint = build_endpoint(scheme, location, &mut options)?;
        options.finish()?;
        Ok(endpoint)
    }
}

impl FromStr for SideConfig {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self> {
        let (scheme, location, mut options) = split_uri(input)?;
        let enabled = options.take_parsed("enabled", true)?;
        let endpoint = build_endpoint(scheme, location, &mut options)?;
        options.finish()?;
        Ok(SideConfig { endpoint, enabled })
    }
}

impl fmt::Display for SideConfig {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let uri = self.endpoint.to_string();
        if self.enabled {
            return formatter.write_str(&uri);
        }
        let separator = if uri.contains('?') { '&' } else { '?' };
        write!(formatter, "{uri}{separator}enabled=false")
    }
}

#[derive(Default)]
struct Query(Vec<String>);

impl Query {
    fn push_if<T: fmt::Display + PartialEq>(&mut self, key: &str, value: T, default: T) {
        if value != default {
            self.0.push(format!("{key}={value}"));
        }
    }

    fn push_some<T: fmt::Display>(&mut self, key: &str, value: Option<T>) {
        if let Some(value) = value {
            self.0.push(format!("{key}={value}"));
        }
    }
}

impl fmt::Display for Query {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.0.is_empty() {
            Ok(())
        } else {
            write!(formatter, "?{}", self.0.join("&"))
        }
    }
}

impl fmt::Display for Endpoint {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Endpoint::TcpClient(config) => {
                let defaults = TcpClientConfig::new(String::new());
                let mut query = Query::default();
                query.push_if(
                    "reconnect_delay_ms",
                    config.reconnect_delay_ms,
                    defaults.reconnect_delay_ms,
                );
                query.push_if(
                    "connect_timeout_ms",
                    config.connect_timeout_ms,
                    defaults.connect_timeout_ms,
                );
                query.push_if("no_delay", config.no_delay, defaults.no_delay);
                write!(formatter, "tcp://{}{query}", config.address)
            }
            Endpoint::TcpServer(config) => {
                let mut query = Query::default();
                query.push_some("max_clients", config.max_clients);
                query.push_if("no_delay", config.no_delay, true);
                write!(formatter, "tcp-server://{}{query}", config.bind)
            }
            Endpoint::UdpClient(config) => {
                let mut query = Query::default();
                query.push_some("bind", config.bind.as_ref());
                write!(formatter, "udp://{}{query}", config.remote)
            }
            Endpoint::UdpServer(config) => {
                let mut query = Query::default();
                query.push_if("reply_to", config.reply_to, ReplyTo::default());
                query.push_some("peer_timeout_secs", config.peer_timeout_secs);
                write!(formatter, "udp-server://{}{query}", config.bind)
            }
            Endpoint::Uart(config) => write!(
                formatter,
                "uart://{}?baud={}&parity={}&data_bits={}&stop_bits={}&flow={}",
                config.port,
                config.baud_rate,
                config.parity,
                config.data_bits,
                config.stop_bits,
                config.flow_control
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::endpoint::{FlowControl, Parity};

    #[test]
    fn round_trips() {
        let uris = [
            "tcp://localhost:9000",
            "tcp-server://0.0.0.0:9000",
            "udp://10.0.0.1:7000",
            "udp://10.0.0.1:7000?bind=0.0.0.0:7001",
            "udp-server://0.0.0.0:5000",
            "tcp://localhost:9000?reconnect_delay_ms=250&connect_timeout_ms=800&no_delay=false",
            "tcp-server://0.0.0.0:9000?max_clients=3&no_delay=false",
            "udp-server://0.0.0.0:5000?reply_to=last&peer_timeout_secs=30",
            "uart:///dev/ttyUSB0?baud=115200&parity=even&data_bits=7&stop_bits=2&flow=hardware",
            "uart://COM3?baud=9600&parity=none&data_bits=8&stop_bits=1&flow=none",
        ];
        for uri in uris {
            let endpoint: Endpoint = uri.parse().unwrap();
            assert_eq!(endpoint.to_string(), uri);
            assert_eq!(endpoint.to_string().parse::<Endpoint>().unwrap(), endpoint);
        }
    }

    #[test]
    fn side_config_enabled_option() {
        let on: SideConfig = "tcp://h:1".parse().unwrap();
        assert!(on.enabled);
        let off: SideConfig = "tcp://h:1?no_delay=false&enabled=false".parse().unwrap();
        assert!(!off.enabled);
        assert_eq!(off.endpoint, "tcp://h:1?no_delay=false".parse().unwrap());
        assert_eq!(off.to_string().parse::<SideConfig>().unwrap(), off);
        assert_eq!(
            "uart:///dev/x?baud=9600&enabled=false"
                .parse::<SideConfig>()
                .unwrap()
                .to_string()
                .matches("enabled=false")
                .count(),
            1
        );
        assert!("tcp://h:1?enabled=maybe".parse::<SideConfig>().is_err());
        assert!("tcp://h:1?enabled=false".parse::<Endpoint>().is_err());
    }

    #[test]
    fn tcp_and_udp_defaults() {
        let client: Endpoint = "tcp://h:1".parse().unwrap();
        assert_eq!(
            client,
            Endpoint::TcpClient(TcpClientConfig {
                address: "h:1".into(),
                reconnect_delay_ms: 1000,
                connect_timeout_ms: 5000,
                no_delay: true,
            })
        );
        let server: Endpoint = "tcp-server://h:1".parse().unwrap();
        assert_eq!(
            server,
            Endpoint::TcpServer(TcpServerConfig {
                bind: "h:1".into(),
                max_clients: None,
                no_delay: true,
            })
        );
        let udp: Endpoint = "udp-server://h:1".parse().unwrap();
        assert_eq!(
            udp,
            Endpoint::UdpServer(UdpServerConfig {
                bind: "h:1".into(),
                reply_to: ReplyTo::All,
                peer_timeout_secs: None,
            })
        );
    }

    #[test]
    fn uart_defaults() {
        let endpoint: Endpoint = "uart://COM3?baud=9600".parse().unwrap();
        assert_eq!(
            endpoint,
            Endpoint::Uart(UartConfig {
                port: "COM3".into(),
                baud_rate: 9600,
                data_bits: 8,
                parity: Parity::None,
                stop_bits: 1,
                flow_control: FlowControl::None,
            })
        );
    }

    #[test]
    fn rejects_bad_input() {
        for uri in [
            "localhost:9000",
            "ftp://host:1",
            "tcp://",
            "uart:///dev/x",
            "uart:///dev/x?baud=1&data_bits=9",
            "uart:///dev/x?baud=1&stop_bits=3",
            "uart:///dev/x?baud=1&parity=weird",
            "tcp-server://0.0.0.0:1?bind=x",
            "tcp://h:1?no_delay=maybe",
            "tcp://h:1?max_clients=2",
            "tcp-server://h:1?max_clients=many",
            "udp-server://h:1?reply_to=nobody",
            "udp-server://h:1?peer_timeout_secs=-1",
        ] {
            assert!(uri.parse::<Endpoint>().is_err(), "{uri}");
        }
    }
}
