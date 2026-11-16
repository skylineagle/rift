use std::fmt;
use std::io;
use std::str::FromStr;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio_serial::{SerialPortBuilderExt, SerialStream};

use super::client_session::run_client;
use super::link::Link;
use crate::error::Error;

const RECONNECT_DELAY: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Parity {
    #[default]
    None,
    Odd,
    Even,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlowControl {
    #[default]
    None,
    Software,
    Hardware,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UartConfig {
    pub port: String,
    pub baud_rate: u32,
    #[serde(default = "default_data_bits")]
    pub data_bits: u8,
    #[serde(default)]
    pub parity: Parity,
    #[serde(default = "default_stop_bits")]
    pub stop_bits: u8,
    #[serde(default)]
    pub flow_control: FlowControl,
}

fn default_data_bits() -> u8 {
    8
}

fn default_stop_bits() -> u8 {
    1
}

impl fmt::Display for Parity {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Parity::None => "none",
            Parity::Odd => "odd",
            Parity::Even => "even",
        })
    }
}

impl FromStr for Parity {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self, Error> {
        match input {
            "none" => Ok(Parity::None),
            "odd" => Ok(Parity::Odd),
            "even" => Ok(Parity::Even),
            other => Err(Error::InvalidUri(format!("unknown parity `{other}`"))),
        }
    }
}

impl fmt::Display for FlowControl {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            FlowControl::None => "none",
            FlowControl::Software => "software",
            FlowControl::Hardware => "hardware",
        })
    }
}

impl FromStr for FlowControl {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self, Error> {
        match input {
            "none" => Ok(FlowControl::None),
            "software" => Ok(FlowControl::Software),
            "hardware" => Ok(FlowControl::Hardware),
            other => Err(Error::InvalidUri(format!("unknown flow control `{other}`"))),
        }
    }
}

pub(crate) async fn run(config: UartConfig, link: Link) {
    run_client(config.port.clone(), link, RECONNECT_DELAY, || {
        std::future::ready(open_port(&config))
    })
    .await;
}

fn open_port(config: &UartConfig) -> io::Result<SerialStream> {
    tokio_serial::new(&config.port, config.baud_rate)
        .data_bits(data_bits(config.data_bits)?)
        .parity(parity(config.parity))
        .stop_bits(stop_bits(config.stop_bits)?)
        .flow_control(flow_control(config.flow_control))
        .open_native_async()
        .map_err(io::Error::from)
}

fn data_bits(value: u8) -> io::Result<tokio_serial::DataBits> {
    match value {
        5 => Ok(tokio_serial::DataBits::Five),
        6 => Ok(tokio_serial::DataBits::Six),
        7 => Ok(tokio_serial::DataBits::Seven),
        8 => Ok(tokio_serial::DataBits::Eight),
        other => Err(invalid_setting(format!("data_bits {other} not in 5-8"))),
    }
}

fn stop_bits(value: u8) -> io::Result<tokio_serial::StopBits> {
    match value {
        1 => Ok(tokio_serial::StopBits::One),
        2 => Ok(tokio_serial::StopBits::Two),
        other => Err(invalid_setting(format!("stop_bits {other} not in 1-2"))),
    }
}

fn parity(value: Parity) -> tokio_serial::Parity {
    match value {
        Parity::None => tokio_serial::Parity::None,
        Parity::Odd => tokio_serial::Parity::Odd,
        Parity::Even => tokio_serial::Parity::Even,
    }
}

fn flow_control(value: FlowControl) -> tokio_serial::FlowControl {
    match value {
        FlowControl::None => tokio_serial::FlowControl::None,
        FlowControl::Software => tokio_serial::FlowControl::Software,
        FlowControl::Hardware => tokio_serial::FlowControl::Hardware,
    }
}

fn invalid_setting(message: String) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}
