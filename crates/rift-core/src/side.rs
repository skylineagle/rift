use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    A,
    B,
}

impl Side {
    pub fn opposite(self) -> Side {
        match self {
            Side::A => Side::B,
            Side::B => Side::A,
        }
    }
}

impl fmt::Display for Side {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Side::A => formatter.write_str("A"),
            Side::B => formatter.write_str("B"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Target {
    A,
    B,
    Both,
}

impl Target {
    pub fn sides(self) -> Vec<Side> {
        match self {
            Target::A => vec![Side::A],
            Target::B => vec![Side::B],
            Target::Both => vec![Side::A, Side::B],
        }
    }
}

impl FromStr for Target {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self, Error> {
        match input.to_ascii_lowercase().as_str() {
            "a" => Ok(Target::A),
            "b" => Ok(Target::B),
            "both" => Ok(Target::Both),
            other => Err(Error::InvalidPayload(format!(
                "unknown target `{other}`, expected a, b or both"
            ))),
        }
    }
}
