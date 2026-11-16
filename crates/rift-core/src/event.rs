use std::fmt;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::side::Side;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum ConnectionState {
    Disabled,
    Listening,
    Connecting,
    Connected { peer: String },
    Disconnected { peer: Option<String> },
    Error { message: String },
}

impl fmt::Display for ConnectionState {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConnectionState::Disabled => formatter.write_str("disabled"),
            ConnectionState::Listening => formatter.write_str("listening"),
            ConnectionState::Connecting => formatter.write_str("connecting"),
            ConnectionState::Connected { peer } => write!(formatter, "connected {peer}"),
            ConnectionState::Disconnected { peer: Some(peer) } => {
                write!(formatter, "disconnected {peer}")
            }
            ConnectionState::Disconnected { peer: None } => formatter.write_str("disconnected"),
            ConnectionState::Error { message } => write!(formatter, "error: {message}"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Origin {
    Received,
    Forwarded,
    Injected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Event {
    Data {
        profile: String,
        timestamp: DateTime<Utc>,
        source: Side,
        target: Side,
        origin: Origin,
        bytes: Vec<u8>,
        delivered: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        undelivered_reason: Option<String>,
    },
    Status {
        profile: String,
        timestamp: DateTime<Utc>,
        side: Side,
        state: ConnectionState,
    },
}

impl Event {
    pub fn data(
        profile: &str,
        source: Side,
        target: Side,
        origin: Origin,
        bytes: &[u8],
        delivered: bool,
    ) -> Self {
        Event::Data {
            profile: profile.to_string(),
            timestamp: Utc::now(),
            source,
            target,
            origin,
            bytes: bytes.to_vec(),
            delivered,
            undelivered_reason: None,
        }
    }

    pub fn status(profile: &str, side: Side, state: ConnectionState) -> Self {
        Event::Status {
            profile: profile.to_string(),
            timestamp: Utc::now(),
            side,
            state,
        }
    }
}
