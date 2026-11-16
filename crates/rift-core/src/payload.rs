use std::fs;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayloadFormat {
    Text,
    Hex,
    Binary,
    File,
}

impl FromStr for PayloadFormat {
    type Err = Error;

    fn from_str(input: &str) -> Result<Self> {
        match input.to_ascii_lowercase().as_str() {
            "text" => Ok(PayloadFormat::Text),
            "hex" => Ok(PayloadFormat::Hex),
            "bin" | "binary" => Ok(PayloadFormat::Binary),
            "file" => Ok(PayloadFormat::File),
            other => Err(invalid(format!(
                "unknown format `{other}`, expected text, hex, bin or file"
            ))),
        }
    }
}

pub fn parse_payload(format: PayloadFormat, input: &str) -> Result<Vec<u8>> {
    match format {
        PayloadFormat::Text => parse_text(input),
        PayloadFormat::Hex => parse_hex(input),
        PayloadFormat::Binary => parse_binary(input),
        PayloadFormat::File => Ok(fs::read(input)?),
    }
}

fn invalid(message: String) -> Error {
    Error::InvalidPayload(message)
}

fn parse_text(input: &str) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut characters = input.chars();
    while let Some(character) = characters.next() {
        if character == '\\' {
            bytes.push(parse_escape(&mut characters)?);
        } else {
            let mut encoded = [0u8; 4];
            bytes.extend_from_slice(character.encode_utf8(&mut encoded).as_bytes());
        }
    }
    Ok(bytes)
}

fn parse_escape(characters: &mut std::str::Chars<'_>) -> Result<u8> {
    match characters.next() {
        Some('r') => Ok(b'\r'),
        Some('n') => Ok(b'\n'),
        Some('t') => Ok(b'\t'),
        Some('\\') => Ok(b'\\'),
        Some('0') => Ok(0),
        Some('x') => {
            let digits: String = characters.take(2).collect();
            if digits.len() != 2 {
                return Err(invalid("`\\x` needs two hex digits".to_string()));
            }
            u8::from_str_radix(&digits, 16)
                .map_err(|_| invalid(format!("invalid hex escape `\\x{digits}`")))
        }
        Some(other) => Err(invalid(format!("unknown escape `\\{other}`"))),
        None => Err(invalid("trailing backslash".to_string())),
    }
}

fn parse_hex(input: &str) -> Result<Vec<u8>> {
    let digits: String = input
        .split(|character: char| character.is_whitespace() || character == ',' || character == ':')
        .filter(|token| !token.is_empty())
        .map(strip_hex_prefix)
        .collect();
    if !digits.len().is_multiple_of(2) {
        return Err(invalid("odd number of hex digits".to_string()));
    }
    digits
        .as_bytes()
        .chunks(2)
        .map(|pair| {
            let pair = std::str::from_utf8(pair).map_err(|_| invalid("invalid hex".to_string()))?;
            u8::from_str_radix(pair, 16).map_err(|_| invalid(format!("invalid hex byte `{pair}`")))
        })
        .collect()
}

fn strip_hex_prefix(token: &str) -> &str {
    token
        .strip_prefix("0x")
        .or_else(|| token.strip_prefix("0X"))
        .unwrap_or(token)
}

fn parse_binary(input: &str) -> Result<Vec<u8>> {
    input.split_whitespace().map(parse_bit_group).collect()
}

fn parse_bit_group(group: &str) -> Result<u8> {
    if group.len() > 8 {
        return Err(invalid(format!("`{group}` has more than 8 bits")));
    }
    u8::from_str_radix(group, 2).map_err(|_| invalid(format!("`{group}` is not a bit group")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_escapes() {
        let bytes = parse_payload(PayloadFormat::Text, "a\\r\\n\\t\\\\\\0\\x41").unwrap();
        assert_eq!(bytes, b"a\r\n\t\\\0A");
    }

    #[test]
    fn text_errors() {
        assert!(parse_payload(PayloadFormat::Text, "bad\\q").is_err());
        assert!(parse_payload(PayloadFormat::Text, "end\\").is_err());
        assert!(parse_payload(PayloadFormat::Text, "\\x4").is_err());
        assert!(parse_payload(PayloadFormat::Text, "\\xzz").is_err());
    }

    #[test]
    fn hex_is_tolerant() {
        let expected = vec![0xde, 0xad, 0xbe, 0xef];
        for input in [
            "de ad be ef",
            "DE:AD:BE:EF",
            "0xde, 0xad, 0xbe, 0xef",
            "deadbeef",
        ] {
            assert_eq!(parse_payload(PayloadFormat::Hex, input).unwrap(), expected);
        }
    }

    #[test]
    fn hex_errors() {
        assert!(parse_payload(PayloadFormat::Hex, "abc").is_err());
        assert!(parse_payload(PayloadFormat::Hex, "zz").is_err());
    }

    #[test]
    fn binary_groups() {
        let bytes = parse_payload(PayloadFormat::Binary, "01000001 101  1").unwrap();
        assert_eq!(bytes, vec![0x41, 0b101, 1]);
    }

    #[test]
    fn binary_errors() {
        assert!(parse_payload(PayloadFormat::Binary, "012").is_err());
        assert!(parse_payload(PayloadFormat::Binary, "111111111").is_err());
    }

    #[test]
    fn file_reads_bytes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("frame.bin");
        std::fs::write(&path, [1u8, 2, 3]).unwrap();
        let bytes = parse_payload(PayloadFormat::File, path.to_str().unwrap()).unwrap();
        assert_eq!(bytes, vec![1, 2, 3]);
        assert!(parse_payload(PayloadFormat::File, "/nonexistent/rift").is_err());
    }

    #[test]
    fn format_names() {
        assert_eq!(
            "bin".parse::<PayloadFormat>().unwrap(),
            PayloadFormat::Binary
        );
        assert!("nope".parse::<PayloadFormat>().is_err());
    }
}
