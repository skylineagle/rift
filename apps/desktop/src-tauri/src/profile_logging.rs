use rift_core::{LogRecord, ProfileStore};

pub fn saved_record(store: &ProfileStore, previous_name: Option<&str>, name: &str) -> LogRecord {
    let existing = previous_name.unwrap_or(name);
    if store.get(existing).is_none() {
        added_record(name)
    } else if existing != name {
        record("profile.renamed", "renamed", name)
            .field("from", existing)
            .field("to", name)
    } else {
        record("profile.updated", "updated", name)
    }
}

pub fn added_record(name: &str) -> LogRecord {
    record("profile.added", "added", name)
}

pub fn imported_record(name: &str) -> LogRecord {
    added_record(name).field("source", "import")
}

pub fn removed_record(name: &str) -> LogRecord {
    record("profile.removed", "removed", name)
}

fn record(event: &str, action: &str, name: &str) -> LogRecord {
    LogRecord::info(event, format!("{name} {action}")).profile(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> ProfileStore {
        toml::from_str(
            r#"
[[profile]]
name = "gps"
a = { kind = "tcp-client", address = "h:1" }
b = { kind = "tcp-client", address = "h:2" }
"#,
        )
        .unwrap()
    }

    #[test]
    fn unknown_profiles_are_added() {
        assert_eq!(saved_record(&store(), None, "new").event, "profile.added");
    }

    #[test]
    fn existing_profiles_are_updated() {
        for previous_name in [None, Some("gps")] {
            let saved = saved_record(&store(), previous_name, "gps");
            assert_eq!(saved.event, "profile.updated");
        }
    }

    #[test]
    fn changed_names_are_renamed_with_both_names() {
        let saved = saved_record(&store(), Some("gps"), "radar");
        assert_eq!(saved.event, "profile.renamed");
        assert_eq!(saved.fields["from"], "gps");
        assert_eq!(saved.fields["to"], "radar");
    }

    #[test]
    fn imports_are_marked_with_their_source() {
        let imported = imported_record("gps");
        assert_eq!(imported.event, "profile.added");
        assert_eq!(imported.fields["source"], "import");
    }
}
