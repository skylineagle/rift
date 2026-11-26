use std::io::{BufRead, BufReader, ErrorKind, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::Path;
use std::time::Duration;

use super::hosts::{self, HostRecord};
use super::protocol::{ControlRequest, ControlResponse, Envelope, HostStatus, MAX_MESSAGE_BYTES};
use crate::error::{Error, Result};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const TRANSFER_TIMEOUT: Duration = Duration::from_secs(5);

pub fn send(request: ControlRequest) -> Result<ControlResponse> {
    send_in(&hosts::hosts_directory()?, request)
}

pub fn status_all() -> Result<Vec<HostStatus>> {
    status_all_in(&hosts::hosts_directory()?)
}

pub(super) fn send_in(directory: &Path, request: ControlRequest) -> Result<ControlResponse> {
    let mut reached_host = false;
    let mut transport_failure = None;
    for (path, host) in hosts::read_all(directory)? {
        match exchange(&host, &request) {
            Ok(response) if response.ok => return Ok(response),
            Ok(response) if response.is_not_running() => reached_host = true,
            Ok(response) => {
                return Err(Error::Control(response.error.unwrap_or_default()));
            }
            Err(error) if is_refused(&error) => {
                let _ = std::fs::remove_file(path);
            }
            Err(error) => transport_failure = Some(error),
        }
    }
    Err(match transport_failure {
        Some(error) => error,
        None => unanswered(&request, reached_host),
    })
}

pub(super) fn status_all_in(directory: &Path) -> Result<Vec<HostStatus>> {
    let mut statuses = Vec::new();
    for (path, host) in hosts::read_all(directory)? {
        match exchange(&host, &ControlRequest::Status) {
            Ok(ControlResponse {
                ok: true,
                data: Some(data),
                ..
            }) => statuses.push(
                serde_json::from_value(data).map_err(|error| Error::Control(error.to_string()))?,
            ),
            Err(error) if is_refused(&error) => {
                let _ = std::fs::remove_file(path);
            }
            _ => {}
        }
    }
    Ok(statuses)
}

fn exchange(host: &HostRecord, request: &ControlRequest) -> Result<ControlResponse> {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, host.port));
    let mut stream = TcpStream::connect_timeout(&address, CONNECT_TIMEOUT)?;
    stream.set_read_timeout(Some(TRANSFER_TIMEOUT))?;
    stream.set_write_timeout(Some(TRANSFER_TIMEOUT))?;
    let mut encoded = serde_json::to_vec(&Envelope {
        token: host.token.clone(),
        request: request.clone(),
    })
    .map_err(|error| Error::Control(error.to_string()))?;
    if encoded.len() as u64 >= MAX_MESSAGE_BYTES {
        return Err(Error::Control("request exceeds 1 MiB".to_string()));
    }
    encoded.push(b'\n');
    stream.write_all(&encoded)?;
    let mut line = String::new();
    BufReader::new(stream.take(MAX_MESSAGE_BYTES)).read_line(&mut line)?;
    serde_json::from_str(&line)
        .map_err(|error| Error::Control(format!("invalid response: {error}")))
}

fn is_refused(error: &Error) -> bool {
    matches!(error, Error::Io(io_error) if io_error.kind() == ErrorKind::ConnectionRefused)
}

fn unanswered(request: &ControlRequest, reached_host: bool) -> Error {
    let message = match request {
        ControlRequest::Inject { profile, .. } | ControlRequest::StartWorkflow { profile, .. }
            if reached_host =>
        {
            format!("profile `{profile}` is not running in any Rift instance")
        }
        ControlRequest::StopWorkflow { profile, workflow } if reached_host => format!(
            "workflow `{workflow}` of profile `{profile}` is not running in any Rift instance"
        ),
        _ => "no running Rift instance found".to_string(),
    };
    Error::Control(message)
}
