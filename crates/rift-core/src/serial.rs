use serde::{Deserialize, Serialize};
use tokio_serial::SerialPortType;

use crate::error::Result;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub name: String,
    pub kind: String,
    pub description: Option<String>,
}

pub fn list_serial_ports() -> Result<Vec<SerialPortInfo>> {
    Ok(tokio_serial::available_ports()?
        .into_iter()
        .map(|port| match port.port_type {
            SerialPortType::UsbPort(usb) => SerialPortInfo {
                name: port.port_name,
                kind: "usb".to_string(),
                description: usb.product,
            },
            SerialPortType::PciPort => describe(port.port_name, "pci"),
            SerialPortType::BluetoothPort => describe(port.port_name, "bluetooth"),
            SerialPortType::Unknown => describe(port.port_name, "unknown"),
        })
        .collect())
}

fn describe(name: String, kind: &str) -> SerialPortInfo {
    SerialPortInfo {
        name,
        kind: kind.to_string(),
        description: None,
    }
}
