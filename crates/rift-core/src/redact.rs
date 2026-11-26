const REDACTED: &str = "<redacted>";

pub(crate) fn redact_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return REDACTED.to_string();
    };
    let (authority, tail) = rest.split_at(rest.find(['/', '?', '#']).unwrap_or(rest.len()));
    let host = authority
        .rsplit_once('@')
        .map_or(authority, |(_, host)| host);
    if !has_valid_port(host) {
        return format!("{scheme}://{REDACTED}");
    }
    let path = tail.split(['?', '#']).next().unwrap_or_default();
    format!("{scheme}://{host}{path}")
}

fn has_valid_port(host: &str) -> bool {
    match host.rsplit_once(':') {
        Some((_, port)) if !host.ends_with(']') => port.parse::<u16>().is_ok(),
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_credentials_and_query() {
        for (url, expected) in [
            (
                "amqp://user:secret@broker:5672/vhost",
                "amqp://broker:5672/vhost",
            ),
            ("amqp://user:p@ss@broker/vhost", "amqp://broker/vhost"),
            (
                "wss://example.com/feed?token=secret",
                "wss://example.com/feed",
            ),
            ("wss://key:secret@[::1]/feed#secret", "wss://[::1]/feed"),
            ("ws://h:1?email=a@b.com", "ws://h:1"),
        ] {
            assert_eq!(redact_url(url), expected, "{url}");
        }
    }

    #[test]
    fn hides_everything_when_the_address_cannot_be_trusted() {
        assert_eq!(redact_url("amqp://user:pa/ss@broker"), "amqp://<redacted>");
        assert_eq!(redact_url("user:secret@broker"), "<redacted>");
    }
}
