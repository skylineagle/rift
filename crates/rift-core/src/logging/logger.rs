use std::collections::BTreeSet;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use super::config::LoggingConfig;
use super::record::LogRecord;
use super::sinks::Sinks;

pub(crate) const PROFILE_STARTED: &str = "profile.started";
pub(crate) const PROFILE_STOPPED: &str = "profile.stopped";
const FLUSH_TIMEOUT: Duration = Duration::from_secs(5);

enum Command {
    Record(Box<LogRecord>),
    Configure(Box<LoggingConfig>),
    Flush(Sender<()>),
}

struct Shared {
    config: RwLock<LoggingConfig>,
    commands: Sender<Command>,
    running_profiles: Mutex<BTreeSet<String>>,
}

#[derive(Clone)]
pub struct Logger {
    shared: Arc<Shared>,
}

impl Logger {
    pub fn new(config: LoggingConfig) -> Self {
        let (commands, received) = mpsc::channel();
        let sinks_config = config.clone();
        thread::spawn(move || run(Sinks::new(sinks_config), received));
        Self {
            shared: Arc::new(Shared {
                config: RwLock::new(config),
                commands,
                running_profiles: Mutex::default(),
            }),
        }
    }

    pub fn disabled() -> Self {
        Self::new(LoggingConfig::default())
    }

    pub fn reconfigure(&self, config: LoggingConfig) {
        {
            let mut current = self.shared.config.write().unwrap();
            *current = config.clone();
            self.send(Command::Configure(Box::new(config.clone())));
        }
        self.log(
            LogRecord::info("logging.configured", "logging configured")
                .field("log_level", config.level),
        );
    }

    pub fn config(&self) -> LoggingConfig {
        self.shared.config.read().unwrap().clone()
    }

    pub fn log(&self, record: LogRecord) {
        self.track_running_profiles(&record);
        let config = self.shared.config.read().unwrap();
        if config.has_enabled_sink() && record.level >= config.level {
            self.send(Command::Record(Box::new(record)));
        }
    }

    pub fn flush(&self) {
        let (done, flushed) = mpsc::channel();
        self.send(Command::Flush(done));
        let _ = flushed.recv_timeout(FLUSH_TIMEOUT);
    }

    pub(super) fn stats_interval(&self) -> Option<Duration> {
        let seconds = self.shared.config.read().unwrap().stats_interval_secs;
        (seconds > 0).then(|| Duration::from_secs(seconds))
    }

    pub(super) fn running_profiles(&self) -> Vec<String> {
        let running = self.shared.running_profiles.lock().unwrap();
        running.iter().cloned().collect()
    }

    fn track_running_profiles(&self, record: &LogRecord) {
        let Some(profile) = &record.profile else {
            return;
        };
        let mut running = self.shared.running_profiles.lock().unwrap();
        match record.event.as_str() {
            PROFILE_STARTED => {
                running.insert(profile.clone());
            }
            PROFILE_STOPPED => {
                running.remove(profile);
            }
            _ => {}
        }
    }

    fn send(&self, command: Command) {
        let _ = self.shared.commands.send(command);
    }
}

fn run(mut sinks: Sinks, commands: Receiver<Command>) {
    for command in commands {
        match command {
            Command::Record(record) => sinks.write(&record),
            Command::Configure(config) => sinks.configure(*config),
            Command::Flush(done) => sinks.flush(done),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::*;
    use crate::logging::{FileSinkConfig, LogLevel};

    fn file_config(directory: &Path) -> LoggingConfig {
        LoggingConfig {
            file: FileSinkConfig {
                enabled: true,
                directory: Some(directory.to_path_buf()),
                ..FileSinkConfig::default()
            },
            ..LoggingConfig::default()
        }
    }

    #[test]
    fn writes_records_at_or_above_the_level_and_applies_reconfiguration() {
        let directory = tempfile::tempdir().unwrap();
        let mut config = file_config(directory.path());
        let logger = Logger::new(config.clone());
        logger.log(LogRecord::debug("test.hidden", "hidden"));
        logger.log(LogRecord::info("test.shown", "shown"));
        config.level = LogLevel::Debug;
        logger.reconfigure(config.clone());
        logger.log(LogRecord::debug("test.verbose", "verbose"));
        logger.flush();
        let written = fs::read_to_string(directory.path().join("rift.log")).unwrap();
        assert_eq!(logger.config(), config);
        assert!(!written.contains("test.hidden"));
        for event in ["test.shown", "logging.configured", "test.verbose"] {
            assert!(written.contains(event), "{event}");
        }
    }

    #[test]
    fn disabled_logger_flushes_without_waiting() {
        let logger = Logger::disabled();
        logger.log(LogRecord::error("test.event", "message"));
        let started = std::time::Instant::now();
        logger.flush();
        assert!(started.elapsed() < FLUSH_TIMEOUT);
    }

    #[test]
    fn tracks_running_profiles_regardless_of_sinks() {
        let logger = Logger::disabled();
        logger.log(LogRecord::info(PROFILE_STARTED, "started").profile("gps"));
        assert_eq!(logger.running_profiles(), ["gps"]);
        logger.log(LogRecord::info(PROFILE_STOPPED, "stopped").profile("gps"));
        assert!(logger.running_profiles().is_empty());
    }
}
