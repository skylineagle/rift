use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::level::LogLevel;

pub(super) const DEFAULT_FILE_NAME: &str = "rift.log";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct LoggingConfig {
    pub level: LogLevel,
    pub stats_interval_secs: u64,
    pub console: ConsoleSinkConfig,
    pub file: FileSinkConfig,
    pub http: HttpSinkConfig,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::default(),
            stats_interval_secs: 60,
            console: ConsoleSinkConfig::default(),
            file: FileSinkConfig::default(),
            http: HttpSinkConfig::default(),
        }
    }
}

impl LoggingConfig {
    pub(super) fn has_enabled_sink(&self) -> bool {
        self.console.enabled || self.file.enabled || self.http.enabled
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct ConsoleSinkConfig {
    pub enabled: bool,
    pub format: ConsoleFormat,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConsoleFormat {
    #[default]
    Text,
    Json,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct FileSinkConfig {
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub directory: Option<PathBuf>,
    pub file_name: String,
    pub rotate: RotationPolicy,
    pub max_file_bytes: u64,
    pub max_files: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_total_bytes: Option<u64>,
}

impl Default for FileSinkConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            directory: None,
            file_name: String::new(),
            rotate: RotationPolicy::default(),
            max_file_bytes: 10 * 1024 * 1024,
            max_files: 10,
            max_total_bytes: None,
        }
    }
}

impl FileSinkConfig {
    pub(super) fn named(&self, default_file_name: &str) -> Self {
        let mut named = self.clone();
        if named.file_name.is_empty() {
            named.file_name = default_file_name.to_string();
        }
        named
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RotationPolicy {
    #[default]
    Size,
    Hourly,
    Daily,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct HttpSinkConfig {
    pub enabled: bool,
    pub url: String,
    pub format: HttpFormat,
    pub batch_size: usize,
    pub flush_interval_secs: u64,
    pub timeout_secs: u64,
    pub headers: BTreeMap<String, String>,
}

impl Default for HttpSinkConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            url: "http://localhost:8080".to_string(),
            format: HttpFormat::default(),
            batch_size: 100,
            flush_interval_secs: 5,
            timeout_secs: 10,
            headers: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HttpFormat {
    #[default]
    Ndjson,
    JsonArray,
}

pub fn default_log_directory() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("rift")
        .join("logs")
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = r#"
level = "info"
stats_interval_secs = 60

[console]
enabled = false
format = "text"

[file]
enabled = false
directory = "/path"
file_name = "rift.log"
rotate = "size"
max_file_bytes = 10485760
max_files = 10
max_total_bytes = 104857600

[http]
enabled = false
url = "http://localhost:8080"
format = "ndjson"
batch_size = 100
flush_interval_secs = 5
timeout_secs = 10
headers = { Authorization = "ApiKey xyz" }
"#;

    #[test]
    fn spec_example_round_trips_through_toml() {
        let config: LoggingConfig = toml::from_str(EXAMPLE).unwrap();
        assert_eq!(config.file.directory, Some(PathBuf::from("/path")));
        assert_eq!(config.file.max_total_bytes, Some(104_857_600));
        assert_eq!(config.http.headers["Authorization"], "ApiKey xyz");
        let written = toml::to_string_pretty(&config).unwrap();
        assert_eq!(toml::from_str::<LoggingConfig>(&written).unwrap(), config);
    }

    #[test]
    fn absent_values_use_defaults_with_every_sink_off() {
        let config: LoggingConfig = toml::from_str("").unwrap();
        assert_eq!(config, LoggingConfig::default());
        assert!(!config.has_enabled_sink());
        let written = toml::to_string(&config).unwrap();
        assert_eq!(toml::from_str::<LoggingConfig>(&written).unwrap(), config);
    }

    #[test]
    fn an_explicit_file_name_wins_over_the_host_default() {
        let unnamed = FileSinkConfig::default();
        assert_eq!(unnamed.named("rift-cli.log").file_name, "rift-cli.log");
        let explicit: FileSinkConfig = toml::from_str("file_name = \"custom.log\"").unwrap();
        assert_eq!(explicit.named("rift-cli.log").file_name, "custom.log");
    }

    #[test]
    fn partial_sections_keep_other_defaults() {
        let config: LoggingConfig =
            toml::from_str("[http]\nenabled = true\nformat = \"json-array\"").unwrap();
        assert_eq!(config.http.format, HttpFormat::JsonArray);
        assert_eq!(config.http.batch_size, 100);
        assert!(config.has_enabled_sink());
    }
}
