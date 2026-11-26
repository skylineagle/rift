use std::net::{Ipv4Addr, TcpListener as StdTcpListener};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;

use super::hosts::{self, HostRecord};
use super::protocol::{ControlResponse, Envelope, MAX_MESSAGE_BYTES};
use crate::error::{Error, Result};
use crate::manager::Rift;
use crate::profile::Profile;
use crate::workflow_runner::Workflows;

mod dispatch;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const ACCEPT_RETRY_DELAY: Duration = Duration::from_millis(100);

pub type ProfileLookup = Arc<dyn Fn(&str) -> Option<Profile> + Send + Sync>;

pub struct ControlServer {
    host_file: PathBuf,
    shutdown: CancellationToken,
}

struct Context {
    kind: String,
    token: String,
    rift: Arc<Rift>,
    workflows: Arc<Workflows>,
    profiles: ProfileLookup,
}

impl ControlServer {
    pub fn start(
        kind: &str,
        rift: Arc<Rift>,
        workflows: Arc<Workflows>,
        profiles: ProfileLookup,
    ) -> Result<Self> {
        Self::start_in(&hosts::hosts_directory()?, kind, rift, workflows, profiles)
    }

    pub(super) fn start_in(
        directory: &Path,
        kind: &str,
        rift: Arc<Rift>,
        workflows: Arc<Workflows>,
        profiles: ProfileLookup,
    ) -> Result<Self> {
        let listener = StdTcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
        listener.set_nonblocking(true)?;
        let port = listener.local_addr()?.port();
        let listener = TcpListener::from_std(listener)?;
        let token = hosts::generate_token()?;
        let host_file = hosts::register(
            directory,
            &HostRecord {
                pid: std::process::id(),
                port,
                token: token.clone(),
                kind: kind.to_string(),
            },
        )?;
        let context = Arc::new(Context {
            kind: kind.to_string(),
            token,
            rift,
            workflows,
            profiles,
        });
        let shutdown = CancellationToken::new();
        tokio::spawn(accept_connections(listener, context, shutdown.clone()));
        Ok(Self {
            host_file,
            shutdown,
        })
    }
}

impl Drop for ControlServer {
    fn drop(&mut self) {
        self.shutdown.cancel();
        let _ = std::fs::remove_file(&self.host_file);
    }
}

async fn accept_connections(
    listener: TcpListener,
    context: Arc<Context>,
    shutdown: CancellationToken,
) {
    loop {
        let accepted = tokio::select! {
            _ = shutdown.cancelled() => return,
            accepted = listener.accept() => accepted,
        };
        match accepted {
            Ok((stream, _)) => {
                let context = context.clone();
                tokio::spawn(async move {
                    let _ = timeout(REQUEST_TIMEOUT, serve_connection(stream, &context)).await;
                });
            }
            Err(_) => tokio::time::sleep(ACCEPT_RETRY_DELAY).await,
        }
    }
}

async fn serve_connection(mut stream: TcpStream, context: &Context) -> Result<()> {
    let line = read_request_line(&mut stream).await?;
    let response = respond(context, &line);
    let mut encoded =
        serde_json::to_vec(&response).map_err(|error| Error::Control(error.to_string()))?;
    encoded.push(b'\n');
    stream.write_all(&encoded).await?;
    stream.shutdown().await?;
    Ok(())
}

async fn read_request_line(stream: &mut TcpStream) -> Result<Vec<u8>> {
    let mut line = Vec::new();
    BufReader::new(stream.take(MAX_MESSAGE_BYTES + 1))
        .read_until(b'\n', &mut line)
        .await?;
    Ok(line)
}

fn respond(context: &Context, line: &[u8]) -> ControlResponse {
    if line.len() as u64 > MAX_MESSAGE_BYTES {
        return ControlResponse::rejection("request exceeds 1 MiB".to_string(), false);
    }
    let envelope: Envelope = match serde_json::from_slice(line) {
        Ok(envelope) => envelope,
        Err(error) => {
            return ControlResponse::rejection(format!("invalid request: {error}"), false)
        }
    };
    if envelope.token != context.token {
        return ControlResponse::rejection("invalid token".to_string(), true);
    }
    match dispatch::dispatch(context, envelope.request) {
        Ok(data) => ControlResponse::success(data),
        Err(error) => ControlResponse::failure(&error),
    }
}
