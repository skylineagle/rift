use std::collections::BTreeSet;
use std::io::Write;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use super::config::{LoggingConfig, DEFAULT_FILE_NAME};
use super::level::LogLevel;
use super::queue::{self, Inbox, Outbox, Received};
use super::record::LogRecord;
use super::sinks::Sinks;

pub(crate) const PROFILE_STARTED: &str = "profile.started";
pub(crate) const PROFILE_STOPPED: &str = "profile.stopped";
const FLUSH_TIMEOUT: Duration = Duration::from_secs(5);
const QUEUE_CAPACITY: usize = 10_000;

enum Command {
    Record(Box<LogRecord>),
    Configure(Box<LoggingConfig>),
    Flush(Sender<()>),
}

struct Shared {
    config: RwLock<LoggingConfig>,
    reconfiguring: Mutex<()>,
    commands: Outbox<Command>,
    running_profiles: Mutex<BTreeSet<String>>,
}

#[derive(Clone)]
pub struct Logger {
    shared: Arc<Shared>,
}

impl Logger {
    pub fn new(config: LoggingConfig) -> Self {
        Self::with_default_file_name(config, DEFAULT_FILE_NAME)
    }

    pub fn with_default_file_name(config: LoggingConfig, default_file_name: &str) -> Self {
        let (commands, received) = queue::bounded(QUEUE_CAPACITY);
        let sinks_config = config.clone();
        let default_file_name = default_file_name.to_string();
        thread::spawn(move || run(Sinks::new(sinks_config, default_file_name), received));
        Self {
            shared: Arc::new(Shared {
                config: RwLock::new(config),
                reconfiguring: Mutex::default(),
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
            let _ordered = self.shared.reconfiguring.lock().unwrap();
            if !self.deliver(Command::Configure(Box::new(config.clone()))) {
                let _ = writeln!(std::io::stderr(), "rift: cannot apply the logging config");
                return;
            }
            *self.shared.config.write().unwrap() = config.clone();
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
        if self.enabled(record.level) {
            self.shared
                .commands
                .offer(Command::Record(Box::new(record)));
        }
    }

    pub fn enabled(&self, level: LogLevel) -> bool {
        let config = self.shared.config.read().unwrap();
        config.has_enabled_sink() && level >= config.level
    }

    pub fn flush(&self) {
        let (done, flushed) = mpsc::channel();
        self.deliver(Command::Flush(done));
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

    fn deliver(&self, command: Command) -> bool {
        self.shared.commands.deliver(command, FLUSH_TIMEOUT)
    }
}

fn run(mut sinks: Sinks, commands: Inbox<Command>) {
    loop {
        match commands.receive(Duration::MAX) {
            Received::Item(Command::Record(record)) => sinks.write(&record),
            Received::Item(Command::Configure(config)) => sinks.configure(*config),
            Received::Item(Command::Flush(done)) => {
                if let Some(count) = commands.take_dropped() {
                    sinks.write_dropped(count);
                }
                sinks.flush(done);
            }
            Received::Dropped(count) => sinks.write_dropped(count),
            Received::TimedOut => {}
            Received::Closed => break,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::*;
    use crate::logging::FileSinkConfig;

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
    fn reports_dropped_records_after_the_queue_drains() {
        let directory = tempfile::tempdir().unwrap();
        let (commands, received) = queue::bounded(1);
        for event in ["test.kept", "test.lost", "test.also_lost"] {
            commands.offer(Command::Record(Box::new(LogRecord::info(event, event))));
        }
        drop(commands);
        run(
            Sinks::new(file_config(directory.path()), DEFAULT_FILE_NAME.into()),
            received,
        );
        let written = fs::read_to_string(directory.path().join("rift.log")).unwrap();
        let lines: Vec<&str> = written.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("test.kept"));
        assert!(lines[1].contains("logging.dropped"));
        assert!(lines[1].contains("\"records\":2"));
    }

    #[test]
    fn logging_never_blocks_while_the_http_endpoint_hangs() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut config = LoggingConfig::default();
        config.http.enabled = true;
        config.http.batch_size = 1;
        config.http.url = format!("http://{}", listener.local_addr().unwrap());
        let logger = Logger::new(config);
        let started = std::time::Instant::now();
        for _ in 0..QUEUE_CAPACITY * 5 {
            logger.log(LogRecord::info("test.event", "message"));
        }
        assert!(started.elapsed() < Duration::from_secs(5));
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
