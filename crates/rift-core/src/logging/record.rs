use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Serialize, Serializer};
use serde_json::{Map, Value};

use super::level::LogLevel;
use crate::side::Side;

const SERVICE: &str = "rift";

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LogRecord {
    #[serde(rename = "@timestamp", serialize_with = "serialize_timestamp")]
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub event: String,
    pub message: String,
    service: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub side: Option<Side>,
    #[serde(flatten)]
    pub fields: Map<String, Value>,
}

fn serialize_timestamp<S: Serializer>(
    timestamp: &DateTime<Utc>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(&timestamp.to_rfc3339_opts(SecondsFormat::Millis, true))
}

impl LogRecord {
    pub fn new(level: LogLevel, event: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            level,
            event: event.into(),
            message: message.into(),
            service: SERVICE,
            profile: None,
            side: None,
            fields: Map::new(),
        }
    }

    pub fn debug(event: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(LogLevel::Debug, event, message)
    }

    pub fn info(event: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(LogLevel::Info, event, message)
    }

    pub fn warn(event: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(LogLevel::Warn, event, message)
    }

    pub fn error(event: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(LogLevel::Error, event, message)
    }

    pub fn profile(mut self, profile: &str) -> Self {
        self.profile = Some(profile.to_string());
        self
    }

    pub fn side(mut self, side: Side) -> Self {
        self.side = Some(side);
        self
    }

    pub fn field(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        self.fields.insert(
            key.into(),
            serde_json::to_value(value).unwrap_or(Value::Null),
        );
        self
    }

    pub(super) fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;
    use serde_json::json;

    use super::*;

    #[test]
    fn serializes_as_a_flat_elastic_compatible_object() {
        let mut record = LogRecord::info("side.connected", "gps A connected 10.0.0.5:51234")
            .profile("gps")
            .side(Side::A)
            .field("peer", "10.0.0.5:51234");
        record.timestamp = Utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&record.to_json()).unwrap(),
            json!({
                "@timestamp": "2026-11-26T10:00:00.000Z",
                "level": "info",
                "event": "side.connected",
                "message": "gps A connected 10.0.0.5:51234",
                "service": "rift",
                "profile": "gps",
                "side": "A",
                "peer": "10.0.0.5:51234",
            })
        );
    }

    #[test]
    fn omits_absent_profile_and_side() {
        let json = LogRecord::warn("logging.configured", "configured").to_json();
        assert!(!json.contains("profile"));
        assert!(!json.contains("side"));
    }
}
