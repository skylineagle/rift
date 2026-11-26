use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WireFormat {
    #[default]
    Binary,
    Text,
    Base64,
    Hex,
    Json,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JsonValue {
    #[default]
    Text,
    Base64,
    Hex,
    Json,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MessageFormat {
    #[serde(default)]
    pub format: WireFormat,
    #[serde(default = "default_json_field")]
    pub json_field: String,
    #[serde(default)]
    pub json_value: JsonValue,
}

impl Default for MessageFormat {
    fn default() -> Self {
        Self {
            format: WireFormat::default(),
            json_field: default_json_field(),
            json_value: JsonValue::default(),
        }
    }
}

pub(crate) fn default_json_field() -> String {
    "data".to_string()
}

impl MessageFormat {
    pub(crate) fn encode(&self, bytes: &[u8]) -> Result<Message, String> {
        Ok(match self.format {
            WireFormat::Binary => Message::Binary(Bytes::copy_from_slice(bytes)),
            WireFormat::Text => Message::text(utf8_data(bytes)?),
            WireFormat::Base64 => Message::text(BASE64.encode(bytes)),
            WireFormat::Hex => Message::text(encode_hex(bytes)),
            WireFormat::Json => Message::text(self.wrap_json(bytes)?.to_string()),
        })
    }

    pub(crate) fn decode(&self, message: Message) -> Result<Option<Bytes>, String> {
        let raw = match message {
            Message::Binary(bytes) => bytes,
            Message::Text(text) => Bytes::from(text),
            _ => return Ok(None),
        };
        let decoded = match self.format {
            WireFormat::Binary | WireFormat::Text => raw,
            WireFormat::Base64 => decode_base64(trimmed(&raw)?)?.into(),
            WireFormat::Hex => decode_hex(trimmed(&raw)?)?.into(),
            WireFormat::Json => self.unwrap_json(&raw)?.into(),
        };
        Ok(Some(decoded))
    }

    fn wrap_json(&self, bytes: &[u8]) -> Result<Value, String> {
        let value = match self.json_value {
            JsonValue::Text => Value::String(utf8_data(bytes)?.to_string()),
            JsonValue::Base64 => Value::String(BASE64.encode(bytes)),
            JsonValue::Hex => Value::String(encode_hex(bytes)),
            JsonValue::Json => serde_json::from_slice(bytes)
                .map_err(|error| format!("data is not valid JSON: {error}"))?,
        };
        Ok(nest(self.field_path(), value))
    }

    fn unwrap_json(&self, raw: &[u8]) -> Result<Vec<u8>, String> {
        let message: Value = serde_json::from_slice(raw)
            .map_err(|error| format!("message is not valid JSON: {error}"))?;
        let value = self
            .field_path()
            .try_fold(&message, |value, key| value.get(key))
            .ok_or_else(|| format!("message has no `{}` field", self.json_field))?;
        match (self.json_value, value) {
            (JsonValue::Json, value) => Ok(value.to_string().into_bytes()),
            (JsonValue::Text, Value::String(text)) => Ok(text.clone().into_bytes()),
            (JsonValue::Text, other) => Ok(other.to_string().into_bytes()),
            (JsonValue::Base64, Value::String(text)) => decode_base64(text),
            (JsonValue::Hex, Value::String(text)) => decode_hex(text),
            (_, _) => Err(format!("`{}` must be a string", self.json_field)),
        }
    }

    fn field_path(&self) -> impl Iterator<Item = &str> {
        self.json_field.split('.').filter(|key| !key.is_empty())
    }
}

fn nest<'a>(path: impl Iterator<Item = &'a str>, value: Value) -> Value {
    let keys: Vec<&str> = path.collect();
    keys.into_iter().rev().fold(value, |inner, key| {
        Value::Object(Map::from_iter([(key.to_string(), inner)]))
    })
}

fn utf8_data(bytes: &[u8]) -> Result<&str, String> {
    std::str::from_utf8(bytes).map_err(|error| format!("data is not valid UTF-8: {error}"))
}

fn trimmed(raw: &[u8]) -> Result<&str, String> {
    std::str::from_utf8(raw)
        .map(str::trim)
        .map_err(|_| "message is not valid UTF-8".to_string())
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn decode_hex(text: &str) -> Result<Vec<u8>, String> {
    crate::payload::parse_payload(crate::payload::PayloadFormat::Hex, text)
        .map_err(|error| error.to_string())
}

fn decode_base64(text: &str) -> Result<Vec<u8>, String> {
    BASE64
        .decode(text.trim())
        .map_err(|error| format!("invalid base64: {error}"))
}

macro_rules! text_enum {
    ($name:ident, $label:literal, { $($variant:ident => $text:literal),+ $(,)? }) => {
        impl std::fmt::Display for $name {
            fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str(match self { $($name::$variant => $text),+ })
            }
        }

        impl std::str::FromStr for $name {
            type Err = crate::error::Error;

            fn from_str(input: &str) -> Result<Self, crate::error::Error> {
                match input {
                    $($text => Ok($name::$variant),)+
                    other => Err(crate::error::Error::InvalidUri(format!("unknown {} `{other}`", $label))),
                }
            }
        }
    };
}

pub(crate) use text_enum;

text_enum!(WireFormat, "format", {
    Binary => "binary",
    Text => "text",
    Base64 => "base64",
    Hex => "hex",
    Json => "json",
});

text_enum!(JsonValue, "json_value", {
    Text => "text",
    Base64 => "base64",
    Hex => "hex",
    Json => "json",
});

#[cfg(test)]
mod tests {
    use super::*;

    fn format(format: WireFormat, json_field: &str, json_value: JsonValue) -> MessageFormat {
        MessageFormat {
            format,
            json_field: json_field.into(),
            json_value,
        }
    }

    fn round_trip(codec: &MessageFormat, bytes: &[u8]) -> Vec<u8> {
        let message = codec.encode(bytes).unwrap();
        codec.decode(message).unwrap().unwrap().to_vec()
    }

    #[test]
    fn plain_formats_round_trip() {
        for wire in [WireFormat::Binary, WireFormat::Base64, WireFormat::Hex] {
            let codec = format(wire, "data", JsonValue::Text);
            assert_eq!(round_trip(&codec, b"\x00\xffhi"), b"\x00\xffhi");
        }
        let text = format(WireFormat::Text, "data", JsonValue::Text);
        assert_eq!(text.encode(b"hi").unwrap(), Message::text("hi"));
    }

    #[test]
    fn text_modes_reject_invalid_utf8() {
        for codec in [
            format(WireFormat::Text, "data", JsonValue::Text),
            format(WireFormat::Json, "data", JsonValue::Text),
        ] {
            for bytes in [&b"\xff"[..], &"é".as_bytes()[..1]] {
                assert!(codec.encode(bytes).unwrap_err().contains("UTF-8"));
            }
            assert_eq!(round_trip(&codec, "héllo".as_bytes()), "héllo".as_bytes());
        }
    }

    #[test]
    fn json_wraps_data_under_a_nested_field() {
        let codec = format(WireFormat::Json, "payload.raw", JsonValue::Base64);
        assert_eq!(
            codec.encode(b"hi").unwrap(),
            Message::text(r#"{"payload":{"raw":"aGk="}}"#)
        );
        assert_eq!(round_trip(&codec, b"\x01\x02"), b"\x01\x02");
    }

    #[test]
    fn json_value_embeds_and_extracts_objects() {
        let codec = format(WireFormat::Json, "data", JsonValue::Json);
        assert_eq!(
            codec.encode(br#"{"a":1}"#).unwrap(),
            Message::text(r#"{"data":{"a":1}}"#)
        );
        assert!(codec.encode(b"not json").is_err());
        let decoded = codec
            .decode(Message::text(r#"{"data":[1,2],"x":0}"#))
            .unwrap()
            .unwrap();
        assert_eq!(decoded.as_ref(), b"[1,2]");
    }

    #[test]
    fn json_decode_errors_are_descriptive() {
        let codec = format(WireFormat::Json, "data", JsonValue::Hex);
        assert!(codec
            .decode(Message::text("{}"))
            .unwrap_err()
            .contains("no `data`"));
        assert!(codec.decode(Message::text("nope")).is_err());
        assert!(codec.decode(Message::text(r#"{"data":5}"#)).is_err());
        assert_eq!(
            codec
                .decode(Message::text(r#"{"data":"0a0b"}"#))
                .unwrap()
                .unwrap()
                .as_ref(),
            b"\x0a\x0b"
        );
    }

    #[test]
    fn control_frames_are_ignored() {
        let codec = MessageFormat::default();
        assert!(codec.decode(Message::Ping(Bytes::new())).unwrap().is_none());
    }
}
