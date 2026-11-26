use std::fs;
use std::path::Path;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::side_config::SideConfig;
use crate::workflow::Workflow;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub a: SideConfig,
    pub b: SideConfig,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub workflows: Vec<Workflow>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ProfileStore {
    #[serde(rename = "profile", default)]
    profiles: Vec<Profile>,
    #[serde(flatten)]
    other_sections: toml::Table,
}

impl ProfileStore {
    pub fn load(path: &Path) -> Result<Self> {
        Ok(toml::from_str(&fs::read_to_string(path)?)?)
    }

    pub fn load_or_default(path: &Path) -> Result<Self> {
        if path.exists() {
            Self::load(path)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, toml::to_string_pretty(self)?)?;
        Ok(())
    }

    pub fn section<T: DeserializeOwned + Default>(&self, name: &str) -> Result<T> {
        match self.other_sections.get(name) {
            Some(section) => Ok(section.clone().try_into()?),
            None => Ok(T::default()),
        }
    }

    pub fn set_section<T: Serialize>(&mut self, name: &str, value: &T) -> Result<()> {
        self.other_sections
            .insert(name.to_string(), toml::Value::try_from(value)?);
        Ok(())
    }

    pub fn import_atomic(&mut self, profiles: Vec<Profile>, path: &Path) -> Result<()> {
        let mut next = self.clone();
        for profile in profiles {
            next.add(profile)?;
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let parent = path.parent().unwrap_or_else(|| Path::new("."));
        let mut file = tempfile::NamedTempFile::new_in(parent)?;
        use std::io::Write;
        file.write_all(toml::to_string_pretty(&next)?.as_bytes())?;
        file.as_file().sync_all()?;
        file.persist(path).map_err(|error| error.error)?;
        *self = next;
        Ok(())
    }

    pub fn list(&self) -> &[Profile] {
        &self.profiles
    }

    pub fn get(&self, name: &str) -> Option<&Profile> {
        self.profiles.iter().find(|profile| profile.name == name)
    }

    pub fn add(&mut self, profile: Profile) -> Result<()> {
        if self.get(&profile.name).is_some() {
            return Err(Error::ProfileExists(profile.name));
        }
        self.profiles.push(profile);
        Ok(())
    }

    pub fn upsert(&mut self, replacing: Option<&str>, profile: Profile) -> Result<()> {
        let existing = replacing.unwrap_or(&profile.name);
        let renamed = existing != profile.name;
        if renamed && self.get(&profile.name).is_some() {
            return Err(Error::ProfileExists(profile.name));
        }
        match self
            .profiles
            .iter_mut()
            .find(|candidate| candidate.name == existing)
        {
            Some(slot) => *slot = profile,
            None => self.profiles.push(profile),
        }
        Ok(())
    }

    pub fn remove(&mut self, name: &str) -> Result<Profile> {
        let index = self
            .profiles
            .iter()
            .position(|profile| profile.name == name)
            .ok_or_else(|| Error::ProfileNotFound(name.to_string()))?;
        Ok(self.profiles.remove(index))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXAMPLE: &str = r#"
[[profile]]
name = "gps"
a = { kind = "tcp-server", bind = "0.0.0.0:9000" }
b = { kind = "uart", port = "/dev/ttyUSB0", baud_rate = 9600 }
"#;

    #[test]
    fn parses_example_with_uart_defaults() {
        let store: ProfileStore = toml::from_str(EXAMPLE).unwrap();
        let profile = store.get("gps").unwrap();
        assert_eq!(
            profile.b,
            "uart:///dev/ttyUSB0?baud=9600&parity=none&data_bits=8&stop_bits=1&flow=none"
                .parse()
                .unwrap()
        );
    }

    #[test]
    fn old_tcp_and_udp_entries_load_with_defaults() {
        let store: ProfileStore = toml::from_str(
            r#"
[[profile]]
name = "old"
a = { kind = "tcp-client", address = "h:1" }
b = { kind = "udp-server", bind = "0.0.0.0:2" }
"#,
        )
        .unwrap();
        let profile = store.get("old").unwrap();
        assert_eq!(profile.a, "tcp://h:1".parse().unwrap());
        assert_eq!(profile.b, "udp-server://0.0.0.0:2".parse().unwrap());
    }

    #[test]
    fn enabled_defaults_to_true_and_can_be_switched_off() {
        let store: ProfileStore = toml::from_str(
            r#"
[[profile]]
name = "mixed"
a = { kind = "tcp-client", address = "h:1" }
b = { kind = "udp-server", bind = "0.0.0.0:2", enabled = false }
"#,
        )
        .unwrap();
        let profile = store.get("mixed").unwrap();
        assert!(profile.a.enabled);
        assert!(!profile.b.enabled);
        let reloaded: ProfileStore =
            toml::from_str(&toml::to_string_pretty(&store).unwrap()).unwrap();
        assert_eq!(reloaded, store);
    }

    #[test]
    fn round_trips_through_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("nested").join("rift.toml");
        let mut store = ProfileStore::default();
        store
            .add(Profile {
                name: "gps".into(),
                a: "tcp-server://0.0.0.0:9000".parse().unwrap(),
                b: "uart:///dev/ttyUSB0?baud=9600&parity=even".parse().unwrap(),
                workflows: Vec::new(),
            })
            .unwrap();
        store
            .add(Profile {
                name: "udp".into(),
                a: "udp://127.0.0.1:7000?bind=0.0.0.0:7001".parse().unwrap(),
                b: "tcp://localhost:9".parse().unwrap(),
                workflows: Vec::new(),
            })
            .unwrap();
        store.save(&path).unwrap();
        assert_eq!(ProfileStore::load(&path).unwrap(), store);
    }

    #[test]
    fn upsert_replaces_in_place_and_handles_rename() {
        let mut store: ProfileStore = toml::from_str(EXAMPLE).unwrap();
        let mut renamed = store.get("gps").unwrap().clone();
        renamed.name = "gps-2".into();
        store.upsert(Some("gps"), renamed.clone()).unwrap();
        assert!(store.get("gps").is_none());
        assert_eq!(store.list()[0], renamed);
        let mut clash = renamed.clone();
        clash.name = "other".into();
        store.upsert(None, clash.clone()).unwrap();
        clash.name = "gps-2".into();
        assert!(store.upsert(Some("other"), clash).is_err());
    }

    #[test]
    fn atomic_import_preserves_store_on_collision_and_write_failure() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("rift.toml");
        let mut store: ProfileStore = toml::from_str(EXAMPLE).unwrap();
        store.save(&path).unwrap();
        let original = store.clone();
        let mut incoming = store.list()[0].clone();
        incoming.name = "new".into();
        assert!(store
            .import_atomic(vec![incoming.clone(), original.list()[0].clone()], &path)
            .is_err());
        assert_eq!(store, original);
        assert_eq!(ProfileStore::load(&path).unwrap(), original);
        assert!(store
            .import_atomic(vec![incoming.clone()], directory.path())
            .is_err());
        assert_eq!(store, original);
        store.import_atomic(vec![incoming], &path).unwrap();
        assert_eq!(store.list().len(), 2);
        assert_eq!(ProfileStore::load(&path).unwrap(), store);
    }

    #[test]
    fn websocket_and_rabbitmq_sides_load_from_toml_and_round_trip() {
        let store: ProfileStore = toml::from_str(
            r#"
[[profile]]
name = "broker"
a = { kind = "websocket-server", bind = "0.0.0.0:8080", path = "/feed", format = "json", json_value = "json" }
b = { kind = "rabbitmq", url = "amqp://guest:guest@localhost:5672", exchange = "events", exchange_type = "topic", routing_key = "rift.out", queue = "rift.in", queue_type = "quorum", max_length = 1000 }

[[profile]]
name = "client"
a = { kind = "websocket-client", url = "wss://example.com/socket", format = "base64" }
b = { kind = "tcp-client", address = "h:1" }
"#,
        )
        .unwrap();
        let broker = store.get("broker").unwrap();
        assert_eq!(
            broker.a,
            "ws-server://0.0.0.0:8080/feed?format=json&json_value=json"
                .parse()
                .unwrap()
        );
        assert_eq!(
            broker.b,
            "amqp://guest:guest@localhost:5672?exchange=events&exchange_type=topic&routing_key=rift.out&queue=rift.in&queue_type=quorum&max_length=1000"
                .parse()
                .unwrap()
        );
        assert_eq!(
            store.get("client").unwrap().a,
            "wss://example.com/socket?format=base64".parse().unwrap()
        );
        let reloaded: ProfileStore =
            toml::from_str(&toml::to_string_pretty(&store).unwrap()).unwrap();
        assert_eq!(reloaded, store);
    }

    #[test]
    fn add_and_remove_rules() {
        let mut store: ProfileStore = toml::from_str(EXAMPLE).unwrap();
        let duplicate = store.get("gps").unwrap().clone();
        assert!(store.add(duplicate).is_err());
        assert!(store.remove("missing").is_err());
        store.remove("gps").unwrap();
        assert!(store.list().is_empty());
    }

    #[test]
    fn keeps_unknown_sections_and_workflows_across_load_and_save() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("rift.toml");
        let content = r#"
[[profile]]
name = "gps"
a = { kind = "tcp-client", address = "h:1" }
b = { kind = "tcp-client", address = "h:2" }

[[profile.workflows]]
name = "heartbeat"
autostart = true
repeat = 10
steps = [
  { action = "send", target = "Both", format = "text", payload = "PING\\r\\n" },
  { action = "wait", millis = 1000 },
]

[logging]
level = "debug"

[logging.http]
enabled = true
headers = { Authorization = "ApiKey xyz" }
"#;
        fs::write(&path, content).unwrap();
        let store = ProfileStore::load(&path).unwrap();
        assert_eq!(store.get("gps").unwrap().workflows[0].steps.len(), 2);
        store.save(&path).unwrap();
        assert_eq!(ProfileStore::load(&path).unwrap(), store);
        let original: toml::Table = toml::from_str(content).unwrap();
        let saved: toml::Table = toml::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(saved["logging"], original["logging"]);
        assert_eq!(
            saved["profile"][0]["workflows"],
            original["profile"][0]["workflows"]
        );
    }

    #[test]
    fn sections_default_when_absent_and_can_be_replaced() {
        let mut store: ProfileStore = toml::from_str(EXAMPLE).unwrap();
        assert!(store.section::<toml::Table>("logging").unwrap().is_empty());
        let mut logging = toml::Table::new();
        logging.insert("level".into(), "warn".into());
        store.set_section("logging", &logging).unwrap();
        assert_eq!(store.section::<toml::Table>("logging").unwrap(), logging);
        assert!(store.section::<Vec<String>>("logging").is_err());
    }
}
