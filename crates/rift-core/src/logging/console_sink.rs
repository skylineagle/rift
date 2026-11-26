use std::io::Write;

use chrono::Local;

use super::config::{ConsoleFormat, ConsoleSinkConfig};
use super::record::LogRecord;

pub(super) struct ConsoleSink {
    format: ConsoleFormat,
}

impl ConsoleSink {
    pub fn new(config: &ConsoleSinkConfig) -> Self {
        Self {
            format: config.format,
        }
    }

    pub fn write(&mut self, record: &LogRecord) {
        let _ = writeln!(std::io::stderr(), "{}", render(self.format, record));
    }

    pub fn flush(&mut self) {
        let _ = std::io::stderr().flush();
    }
}

fn render(format: ConsoleFormat, record: &LogRecord) -> String {
    match format {
        ConsoleFormat::Text => render_text(record),
        ConsoleFormat::Json => record.to_json(),
    }
}

fn render_text(record: &LogRecord) -> String {
    format!(
        "{} {} {} {}",
        record
            .timestamp
            .with_timezone(&Local)
            .format("%H:%M:%S%.3f"),
        record.level,
        record.event,
        record.message
    )
}

#[cfg(test)]
mod tests {
    use chrono::{TimeZone, Utc};

    use super::*;
    use crate::side::Side;

    fn record() -> LogRecord {
        let mut record = LogRecord::info("side.connected", "connected");
        record.timestamp = Utc.with_ymd_and_hms(2026, 11, 26, 10, 5, 9).unwrap();
        record
    }

    #[test]
    fn text_shows_time_level_event_and_message_only() {
        let expected_time = record()
            .timestamp
            .with_timezone(&Local)
            .format("%H:%M:%S%.3f")
            .to_string();
        assert_eq!(
            render(ConsoleFormat::Text, &record().profile("gps").side(Side::B)),
            format!("{expected_time} INFO side.connected connected")
        );
    }

    #[test]
    fn json_is_a_single_record_line() {
        let line = render(ConsoleFormat::Json, &record());
        assert!(line.starts_with("{\"@timestamp\""));
        assert!(!line.contains('\n'));
    }
}
