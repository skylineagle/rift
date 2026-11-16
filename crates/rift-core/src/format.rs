pub fn hex_bytes(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn escaped_ascii(bytes: &[u8]) -> String {
    bytes
        .iter()
        .flat_map(|byte| std::ascii::escape_default(*byte))
        .map(char::from)
        .collect()
}

pub fn hex_dump_line(bytes: &[u8]) -> String {
    format!(
        "{}B  {}  |{}|",
        bytes.len(),
        hex_bytes(bytes),
        escaped_ascii(bytes)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_hex_dump_line() {
        assert_eq!(hex_dump_line(b"Hello"), "5B  48 65 6c 6c 6f  |Hello|");
    }

    #[test]
    fn escapes_control_bytes() {
        assert_eq!(escaped_ascii(b"a\r\n\x01"), "a\\r\\n\\x01");
    }
}
