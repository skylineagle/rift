use std::sync::mpsc::Sender;

use super::config::LoggingConfig;
use super::console_sink::ConsoleSink;
use super::file_sink::FileSink;
use super::http_sink::HttpSink;
use super::level::LogLevel;
use super::queue::dropped_record;
use super::record::LogRecord;

#[derive(Default)]
pub(super) struct Sinks {
    default_file_name: String,
    config: LoggingConfig,
    console: Option<ConsoleSink>,
    file: Option<FileSink>,
    http: Option<HttpSink>,
}

impl Sinks {
    pub fn new(config: LoggingConfig, default_file_name: String) -> Self {
        let mut sinks = Self {
            default_file_name,
            ..Self::default()
        };
        sinks.configure(config);
        sinks
    }

    pub fn configure(&mut self, config: LoggingConfig) {
        if self.config.console != config.console || self.console.is_none() {
            self.console = config
                .console
                .enabled
                .then(|| ConsoleSink::new(&config.console));
        }
        if self.config.file != config.file || self.file.is_none() {
            self.file = config
                .file
                .enabled
                .then(|| FileSink::new(&config.file.named(&self.default_file_name)));
        }
        if self.config.http != config.http || self.http.is_none() {
            self.http = config.http.enabled.then(|| HttpSink::new(&config.http));
        }
        self.config = config;
    }

    pub fn write(&mut self, record: &LogRecord) {
        if let Some(console) = &mut self.console {
            console.write(record);
        }
        if let Some(file) = &mut self.file {
            file.write(record);
        }
        if let Some(http) = &mut self.http {
            http.write(record);
        }
    }

    pub fn write_dropped(&mut self, count: u64) {
        if self.config.level <= LogLevel::Warn {
            self.write(&dropped_record(count));
        }
    }

    pub fn flush(&mut self, done: Sender<()>) {
        if let Some(console) = &mut self.console {
            console.flush();
        }
        if let Some(file) = &mut self.file {
            file.flush();
        }
        match &mut self.http {
            Some(http) => http.flush(done),
            None => {
                let _ = done.send(());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconfigure_adds_and_removes_sinks() {
        let mut config = LoggingConfig::default();
        let mut sinks = Sinks::new(config.clone(), "rift.log".into());
        assert!(sinks.console.is_none() && sinks.file.is_none() && sinks.http.is_none());
        config.console.enabled = true;
        config.http.enabled = true;
        sinks.configure(config.clone());
        assert!(sinks.console.is_some() && sinks.http.is_some() && sinks.file.is_none());
        config.http.enabled = false;
        sinks.configure(config);
        assert!(sinks.http.is_none());
    }
}
