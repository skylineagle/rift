use std::path::Path;

use anyhow::Result;
use rift_core::{LogRecord, Logger, LoggingConfig, ProfileStore};

const LOGGING_SECTION: &str = "logging";

pub fn logging_config(store: &ProfileStore) -> Result<LoggingConfig> {
    Ok(store.section(LOGGING_SECTION)?)
}

pub fn optional_logging_config(path: Option<&Path>) -> Result<LoggingConfig> {
    match path {
        Some(path) => logging_config(&ProfileStore::load_or_default(path)?),
        None => Ok(LoggingConfig::default()),
    }
}

pub fn log_profile_change(config: LoggingConfig, event: &str, action: &str, profile: &str) {
    let logger = Logger::new(config);
    logger.log(LogRecord::info(event, format!("{profile} {action}")).profile(profile));
    logger.flush();
}

#[cfg(test)]
mod tests {
    use rift_core::LogLevel;

    use super::*;

    #[test]
    fn reads_the_logging_section_and_defaults_without_a_config() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("rift.toml");
        assert_eq!(
            optional_logging_config(Some(&path)).unwrap(),
            LoggingConfig::default()
        );
        assert_eq!(
            optional_logging_config(None).unwrap(),
            LoggingConfig::default()
        );
        std::fs::write(&path, "[logging]\nlevel = \"debug\"").unwrap();
        assert_eq!(
            optional_logging_config(Some(&path)).unwrap().level,
            LogLevel::Debug
        );
    }
}
