use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid payload: {0}")]
    InvalidPayload(String),
    #[error("invalid endpoint uri: {0}")]
    InvalidUri(String),
    #[error("profile `{0}` not found")]
    ProfileNotFound(String),
    #[error("profile `{0}` already exists")]
    ProfileExists(String),
    #[error("profile `{0}` is not running")]
    NotRunning(String),
    #[error("profile `{0}` is already running")]
    AlreadyRunning(String),
    #[error("cannot determine the config directory, pass --config")]
    ConfigDirectoryUnavailable,
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    TomlRead(#[from] toml::de::Error),
    #[error(transparent)]
    TomlWrite(#[from] toml::ser::Error),
    #[error(transparent)]
    Serial(#[from] tokio_serial::Error),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}
