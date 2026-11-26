use std::io;
use std::net::{SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::{Duration, Instant};

use anyhow::{bail, Context, Result};

use crate::channel::{prepare_datagram, prepare_stream, Channel};
use crate::kind::Kind;
use crate::pty::Pty;

static NEXT_PORT: AtomicU16 = AtomicU16::new(31000);
const HELLO: &[u8] = b"hello";

fn next_port() -> u16 {
    NEXT_PORT.fetch_add(1, Ordering::Relaxed)
}

fn local(port: u16) -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], port))
}

pub struct Prepared {
    pub uri: String,
    pub toml: String,
    pending: Pending,
}

enum Pending {
    Connect(SocketAddr),
    Accept(TcpListener),
    ToServer {
        socket: UdpSocket,
        server: SocketAddr,
    },
    AsRemote {
        socket: UdpSocket,
        client: SocketAddr,
    },
    Serial(Pty),
}

pub fn prepare(kind: Kind) -> Result<Prepared> {
    Ok(match kind {
        Kind::TcpServer => {
            let address = local(next_port());
            Prepared {
                uri: format!("tcp-server://{address}"),
                toml: format!("{{ kind = \"tcp-server\", bind = \"{address}\" }}"),
                pending: Pending::Connect(address),
            }
        }
        Kind::TcpClient => {
            let listener = TcpListener::bind(local(next_port()))?;
            let address = listener.local_addr()?;
            Prepared {
                uri: format!("tcp://{address}?reconnect_delay_ms=100"),
                toml: format!(
                    "{{ kind = \"tcp-client\", address = \"{address}\", reconnect_delay_ms = 100 }}"
                ),
                pending: Pending::Accept(listener),
            }
        }
        Kind::UdpServer => {
            let server = local(next_port());
            Prepared {
                uri: format!("udp-server://{server}"),
                toml: format!("{{ kind = \"udp-server\", bind = \"{server}\" }}"),
                pending: Pending::ToServer {
                    socket: UdpSocket::bind(local(0))?,
                    server,
                },
            }
        }
        Kind::UdpClient => {
            let socket = UdpSocket::bind(local(next_port()))?;
            let remote = socket.local_addr()?;
            let client = local(next_port());
            Prepared {
                uri: format!("udp://{remote}?bind={client}"),
                toml: format!(
                    "{{ kind = \"udp-client\", remote = \"{remote}\", bind = \"{client}\" }}"
                ),
                pending: Pending::AsRemote { socket, client },
            }
        }
        Kind::Uart => {
            let pty = Pty::open().context("open pty")?;
            Prepared {
                uri: format!("uart://{}?baud=115200", pty.path),
                toml: format!(
                    "{{ kind = \"uart\", port = \"{}\", baud_rate = 115200 }}",
                    pty.path
                ),
                pending: Pending::Serial(pty),
            }
        }
    })
}

pub struct Connected {
    pub channel: Channel,
    pub _pty: Option<Pty>,
}

impl Prepared {
    pub fn connect(self, timeout: Duration) -> Result<Connected> {
        let deadline = Instant::now() + timeout;
        Ok(match self.pending {
            Pending::Connect(address) => Connected {
                channel: prepare_stream(connect_with_retry(address, deadline)?)?,
                _pty: None,
            },
            Pending::Accept(listener) => Connected {
                channel: prepare_stream(accept_until(listener, deadline)?)?,
                _pty: None,
            },
            Pending::ToServer { socket, server } => {
                socket.send_to(HELLO, server)?;
                Connected {
                    channel: prepare_datagram(socket, server)?,
                    _pty: None,
                }
            }
            Pending::AsRemote { socket, client } => Connected {
                channel: prepare_datagram(socket, client)?,
                _pty: None,
            },
            Pending::Serial(pty) => Connected {
                channel: Channel::Pty(pty.master.clone()),
                _pty: Some(pty),
            },
        })
    }

    pub fn connect_address(&self) -> Option<SocketAddr> {
        match &self.pending {
            Pending::Connect(address) => Some(*address),
            _ => None,
        }
    }
}

pub fn connect_with_retry(address: SocketAddr, deadline: Instant) -> Result<TcpStream> {
    loop {
        match TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
            Ok(stream) => return Ok(stream),
            Err(error) if Instant::now() > deadline => bail!("connect {address}: {error}"),
            Err(_) => std::thread::sleep(Duration::from_millis(20)),
        }
    }
}

fn accept_until(listener: TcpListener, deadline: Instant) -> Result<TcpStream> {
    listener.set_nonblocking(true)?;
    loop {
        match listener.accept() {
            Ok((stream, _)) => {
                stream.set_nonblocking(false)?;
                return Ok(stream);
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    bail!("rift never connected to {}", listener.local_addr()?);
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(error) => return Err(error.into()),
        }
    }
}
