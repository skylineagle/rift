use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use bytes::Bytes;
use tokio::sync::broadcast;

use crate::bridge::{Bridge, BridgeStatus};
use crate::error::{Error, Result};
use crate::event::Event;
use crate::logging::{LogRecord, Logger};
use crate::profile::Profile;
use crate::side::{Side, Target};
use crate::side_config::SideConfig;

const EVENT_CAPACITY: usize = 4096;

struct RunningProfile {
    bridge: Arc<Bridge>,
    profile: Profile,
}

pub struct Rift {
    bridges: Mutex<HashMap<String, RunningProfile>>,
    events: broadcast::Sender<Event>,
    logger: Logger,
}

impl Default for Rift {
    fn default() -> Self {
        Self::new()
    }
}

impl Rift {
    pub fn new() -> Self {
        Self::with_logger(Logger::disabled())
    }

    pub fn with_logger(logger: Logger) -> Self {
        let (events, _) = broadcast::channel(EVENT_CAPACITY);
        Self {
            bridges: Mutex::new(HashMap::new()),
            events,
            logger,
        }
    }

    pub fn logger(&self) -> &Logger {
        &self.logger
    }

    pub fn start(&self, profile: Profile) -> Result<()> {
        let mut bridges = self.bridges.lock().unwrap();
        if bridges.contains_key(&profile.name) {
            return Err(Error::AlreadyRunning(profile.name));
        }
        self.logger
            .log(profile_record("profile.started", "started", &profile));
        let bridge = Arc::new(Bridge::start_with_events(
            profile.clone(),
            self.events.clone(),
        ));
        bridges.insert(profile.name.clone(), RunningProfile { bridge, profile });
        Ok(())
    }

    pub async fn stop(&self, name: &str) -> Result<()> {
        let running = self.bridges.lock().unwrap().remove(name);
        match running {
            Some(running) => {
                self.stop_running(running).await;
                Ok(())
            }
            None => Err(Error::NotRunning(name.to_string())),
        }
    }

    pub async fn stop_all(&self) {
        let stopping: Vec<RunningProfile> = self
            .bridges
            .lock()
            .unwrap()
            .drain()
            .map(|(_, running)| running)
            .collect();
        for running in stopping {
            self.stop_running(running).await;
        }
    }

    pub async fn set_side_enabled(&self, name: &str, side: Side, enabled: bool) -> Result<()> {
        let bridge = self.update_running(name, |profile| {
            side_config(profile, side).enabled = enabled;
            self.logger.log(side_record(profile, side));
        })?;
        bridge.set_side_enabled(side, enabled).await;
        Ok(())
    }

    pub async fn configure_side(&self, name: &str, side: Side, config: SideConfig) -> Result<()> {
        let bridge = self.update_running(name, |profile| {
            *side_config(profile, side) = config.clone();
            self.logger.log(side_record(profile, side));
        })?;
        bridge.configure_side(side, config).await;
        Ok(())
    }

    async fn stop_running(&self, running: RunningProfile) {
        running.bridge.stop().await;
        self.logger.log(profile_record(
            "profile.stopped",
            "stopped",
            &running.profile,
        ));
    }

    fn update_running(&self, name: &str, update: impl FnOnce(&mut Profile)) -> Result<Arc<Bridge>> {
        let mut bridges = self.bridges.lock().unwrap();
        let running = bridges
            .get_mut(name)
            .ok_or_else(|| Error::NotRunning(name.to_string()))?;
        update(&mut running.profile);
        Ok(running.bridge.clone())
    }

    pub fn inject(&self, name: &str, target: Target, bytes: impl Into<Bytes>) -> Result<()> {
        let bridges = self.bridges.lock().unwrap();
        let running = bridges
            .get(name)
            .ok_or_else(|| Error::NotRunning(name.to_string()))?;
        running.bridge.inject(target, bytes);
        Ok(())
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.events.subscribe()
    }

    pub(crate) fn publish(&self, event: Event) {
        let _ = self.events.send(event);
    }

    pub fn running(&self) -> Vec<String> {
        let mut names: Vec<String> = self.bridges.lock().unwrap().keys().cloned().collect();
        names.sort();
        names
    }

    pub fn status(&self) -> Vec<BridgeStatus> {
        let mut statuses: Vec<BridgeStatus> = self
            .bridges
            .lock()
            .unwrap()
            .values()
            .map(|running| running.bridge.status())
            .collect();
        statuses.sort_by(|left, right| left.profile.cmp(&right.profile));
        statuses
    }
}

fn profile_record(event: &str, action: &str, profile: &Profile) -> LogRecord {
    LogRecord::info(event, format!("{} {action}", profile.name))
        .profile(&profile.name)
        .field("a", profile.a.endpoint.to_string())
        .field("b", profile.b.endpoint.to_string())
        .field("a_enabled", profile.a.enabled)
        .field("b_enabled", profile.b.enabled)
}

fn side_config(profile: &mut Profile, side: Side) -> &mut SideConfig {
    match side {
        Side::A => &mut profile.a,
        Side::B => &mut profile.b,
    }
}

fn side_record(profile: &mut Profile, side: Side) -> LogRecord {
    let config = side_config(profile, side);
    let (event, action) = if config.enabled {
        ("side.enabled", "enabled")
    } else {
        ("side.disabled", "disabled")
    };
    let endpoint = config.endpoint.to_string();
    LogRecord::info(event, format!("{} {side} {action}", profile.name))
        .profile(&profile.name)
        .side(side)
        .field("endpoint", endpoint)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::logging::{FileSinkConfig, LoggingConfig};

    #[tokio::test]
    async fn logs_profile_and_side_lifecycle() {
        let directory = tempfile::tempdir().unwrap();
        let logger = Logger::new(LoggingConfig {
            file: FileSinkConfig {
                enabled: true,
                directory: Some(directory.path().to_path_buf()),
                ..FileSinkConfig::default()
            },
            ..LoggingConfig::default()
        });
        let rift = Rift::with_logger(logger);
        let profile: Profile = toml::from_str(
            r#"
name = "gps"
a = { kind = "tcp-server", bind = "127.0.0.1:0" }
b = { kind = "tcp-server", bind = "127.0.0.1:0", enabled = false }
"#,
        )
        .unwrap();
        rift.start(profile.clone()).unwrap();
        assert!(rift.start(profile).is_err());
        rift.set_side_enabled("gps", Side::B, true).await.unwrap();
        rift.set_side_enabled("gps", Side::A, false).await.unwrap();
        rift.stop_all().await;
        rift.logger().flush();
        let written = fs::read_to_string(directory.path().join("rift.log")).unwrap();
        for event in ["profile.started", "side.enabled", "side.disabled"] {
            assert_eq!(written.matches(event).count(), 1, "{event}");
        }
        let stopped = written
            .lines()
            .find(|line| line.contains("profile.stopped"))
            .unwrap();
        assert!(stopped.contains("\"a_enabled\":false"));
        assert!(stopped.contains("\"b_enabled\":true"));
    }
}
