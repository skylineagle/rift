use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};

use chrono::{DateTime, Utc};

use super::config::{default_log_directory, FileSinkConfig, RotationPolicy};
use super::record::LogRecord;
use super::rotation::LogFiles;

pub(super) type Clock = Box<dyn Fn() -> DateTime<Utc> + Send>;

struct OpenFile {
    file: File,
    bytes: u64,
    opened: DateTime<Utc>,
}

pub(super) struct FileSink {
    config: FileSinkConfig,
    files: LogFiles,
    open: Option<OpenFile>,
    clock: Clock,
    failing: bool,
}

impl FileSink {
    pub fn new(config: &FileSinkConfig) -> Self {
        Self::with_clock(config, Box::new(Utc::now))
    }

    pub fn with_clock(config: &FileSinkConfig, clock: Clock) -> Self {
        let directory = config
            .directory
            .clone()
            .unwrap_or_else(default_log_directory);
        Self {
            files: LogFiles::new(directory, config.file_name.clone()),
            config: config.clone(),
            open: None,
            clock,
            failing: false,
        }
    }

    pub fn write(&mut self, record: &LogRecord) {
        let mut line = record.to_json();
        line.push('\n');
        let outcome = self.append(line.as_bytes());
        self.report(outcome);
    }

    pub fn flush(&mut self) {
        if let Some(open) = &mut self.open {
            let outcome = open.file.flush();
            self.report(outcome);
        }
    }

    fn report(&mut self, outcome: io::Result<()>) {
        if let Err(error) = &outcome {
            if !self.failing {
                let path = self.files.current();
                let _ = writeln!(
                    io::stderr(),
                    "rift: cannot write log file {}: {error}",
                    path.display()
                );
            }
        }
        self.failing = outcome.is_err();
    }

    fn append(&mut self, line: &[u8]) -> io::Result<()> {
        let now = (self.clock)();
        let mut open = self.take_or_open(now)?;
        if self.needs_rotation(&open, line.len() as u64, now) {
            drop(open);
            self.files.rotate(now)?;
            open = self.open_current(now)?;
            self.files
                .clean_up(self.config.max_files, self.config.max_total_bytes)?;
        }
        open.file.write_all(line)?;
        open.bytes += line.len() as u64;
        self.open = Some(open);
        Ok(())
    }

    fn take_or_open(&mut self, now: DateTime<Utc>) -> io::Result<OpenFile> {
        match self.open.take() {
            Some(open) => Ok(open),
            None => self.open_current(now),
        }
    }

    fn open_current(&self, now: DateTime<Utc>) -> io::Result<OpenFile> {
        fs::create_dir_all(self.files.directory())?;
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.files.current())?;
        let metadata = file.metadata()?;
        let opened = match metadata.modified() {
            Ok(modified) if metadata.len() > 0 => modified.into(),
            _ => now,
        };
        Ok(OpenFile {
            bytes: metadata.len(),
            file,
            opened,
        })
    }

    fn needs_rotation(&self, open: &OpenFile, incoming: u64, now: DateTime<Utc>) -> bool {
        if open.bytes == 0 {
            return false;
        }
        match self.config.rotate {
            RotationPolicy::Size => open.bytes + incoming > self.config.max_file_bytes,
            policy => policy.period_changed(open.opened, now),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::{Arc, Mutex};

    use chrono::TimeZone;

    use super::*;

    fn config(directory: &Path) -> FileSinkConfig {
        FileSinkConfig {
            enabled: true,
            directory: Some(directory.to_path_buf()),
            file_name: "rift.log".into(),
            ..FileSinkConfig::default()
        }
    }

    fn file_count(directory: &Path) -> usize {
        fs::read_dir(directory).unwrap().count()
    }

    fn record() -> LogRecord {
        LogRecord::info("test.event", "message")
    }

    #[test]
    fn creates_the_directory_and_appends_across_restarts() {
        let root = tempfile::tempdir().unwrap();
        let directory = root.path().join("nested/logs");
        for _ in 0..2 {
            FileSink::new(&config(&directory)).write(&record());
        }
        let written = fs::read_to_string(directory.join("rift.log")).unwrap();
        assert_eq!(written.lines().count(), 2);
    }

    #[test]
    fn rotates_before_a_write_would_exceed_the_size_limit() {
        let directory = tempfile::tempdir().unwrap();
        let record = record();
        let line_bytes = record.to_json().len() as u64 + 1;
        let mut sink = FileSink::new(&FileSinkConfig {
            max_file_bytes: line_bytes * 2,
            max_files: 2,
            ..config(directory.path())
        });
        for _ in 0..2 {
            sink.write(&record);
        }
        assert_eq!(file_count(directory.path()), 1);
        sink.write(&record);
        assert_eq!(file_count(directory.path()), 2);
        for _ in 0..10 {
            sink.write(&record);
        }
        assert_eq!(file_count(directory.path()), 3);
        let current = fs::metadata(directory.path().join("rift.log")).unwrap();
        assert!(current.len() <= line_bytes * 2);
    }

    #[test]
    fn rotates_when_the_injected_clock_enters_a_new_hour() {
        let directory = tempfile::tempdir().unwrap();
        let now = Arc::new(Mutex::new(
            Utc.with_ymd_and_hms(2026, 11, 26, 10, 30, 0).unwrap(),
        ));
        let clock = now.clone();
        let mut sink = FileSink::with_clock(
            &FileSinkConfig {
                rotate: RotationPolicy::Hourly,
                max_file_bytes: 1,
                ..config(directory.path())
            },
            Box::new(move || *clock.lock().unwrap()),
        );
        sink.write(&record());
        sink.write(&record());
        assert_eq!(file_count(directory.path()), 1);
        *now.lock().unwrap() = Utc.with_ymd_and_hms(2026, 11, 26, 11, 0, 0).unwrap();
        sink.write(&record());
        assert!(directory
            .path()
            .join("rift.2026-11-26T11-00-00.log")
            .exists());
        assert_eq!(file_count(directory.path()), 2);
    }
}
