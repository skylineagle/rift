use std::path::{Path, PathBuf};

use crate::error::{Error, Result};

const CONFIG_ENVIRONMENT_VARIABLE: &str = "RIFT_CONFIG";

pub fn resolve_config_path(explicit: Option<&Path>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        return Ok(path.to_path_buf());
    }
    if let Some(path) = std::env::var_os(CONFIG_ENVIRONMENT_VARIABLE) {
        return Ok(PathBuf::from(path));
    }
    dirs::config_dir()
        .map(|directory| directory.join("rift").join("rift.toml"))
        .ok_or(Error::ConfigDirectoryUnavailable)
}
