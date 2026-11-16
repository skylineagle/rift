use std::path::PathBuf;

use anyhow::Result;

use crate::arguments::ConfigArguments;

pub fn resolve(arguments: &ConfigArguments) -> Result<PathBuf> {
    Ok(rift_core::resolve_config_path(arguments.config.as_deref())?)
}
