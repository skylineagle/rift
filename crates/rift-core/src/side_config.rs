use serde::{Deserialize, Serialize};

use crate::endpoint::Endpoint;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SideConfig {
    #[serde(flatten)]
    pub endpoint: Endpoint,
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
}

fn enabled_by_default() -> bool {
    true
}

impl From<Endpoint> for SideConfig {
    fn from(endpoint: Endpoint) -> Self {
        Self {
            endpoint,
            enabled: true,
        }
    }
}
