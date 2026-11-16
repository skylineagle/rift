use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use bytes::Bytes;
use tokio::sync::broadcast;

use crate::bridge::{Bridge, BridgeStatus};
use crate::error::{Error, Result};
use crate::event::Event;
use crate::profile::Profile;
use crate::side::{Side, Target};
use crate::side_config::SideConfig;

const EVENT_CAPACITY: usize = 4096;

pub struct Rift {
    bridges: Mutex<HashMap<String, Arc<Bridge>>>,
    events: broadcast::Sender<Event>,
}

impl Default for Rift {
    fn default() -> Self {
        Self::new()
    }
}

impl Rift {
    pub fn new() -> Self {
        let (events, _) = broadcast::channel(EVENT_CAPACITY);
        Self {
            bridges: Mutex::new(HashMap::new()),
            events,
        }
    }

    pub fn start(&self, profile: Profile) -> Result<()> {
        let mut bridges = self.bridges.lock().unwrap();
        if bridges.contains_key(&profile.name) {
            return Err(Error::AlreadyRunning(profile.name));
        }
        let name = profile.name.clone();
        bridges.insert(
            name,
            Arc::new(Bridge::start_with_events(profile, self.events.clone())),
        );
        Ok(())
    }

    pub async fn stop(&self, name: &str) -> Result<()> {
        let bridge = self.bridges.lock().unwrap().remove(name);
        match bridge {
            Some(bridge) => {
                bridge.stop().await;
                Ok(())
            }
            None => Err(Error::NotRunning(name.to_string())),
        }
    }

    pub async fn stop_all(&self) {
        let bridges: Vec<Arc<Bridge>> = self
            .bridges
            .lock()
            .unwrap()
            .drain()
            .map(|(_, bridge)| bridge)
            .collect();
        for bridge in bridges {
            bridge.stop().await;
        }
    }

    pub async fn set_side_enabled(&self, name: &str, side: Side, enabled: bool) -> Result<()> {
        let bridge = self
            .bridges
            .lock()
            .unwrap()
            .get(name)
            .cloned()
            .ok_or_else(|| Error::NotRunning(name.to_string()))?;
        bridge.set_side_enabled(side, enabled).await;
        Ok(())
    }

    pub async fn configure_side(&self, name: &str, side: Side, config: SideConfig) -> Result<()> {
        let bridge = self
            .bridges
            .lock()
            .unwrap()
            .get(name)
            .cloned()
            .ok_or_else(|| Error::NotRunning(name.to_string()))?;
        bridge.configure_side(side, config).await;
        Ok(())
    }

    pub fn inject(&self, name: &str, target: Target, bytes: impl Into<Bytes>) -> Result<()> {
        let bridges = self.bridges.lock().unwrap();
        let bridge = bridges
            .get(name)
            .ok_or_else(|| Error::NotRunning(name.to_string()))?;
        bridge.inject(target, bytes);
        Ok(())
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.events.subscribe()
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
            .map(|bridge| bridge.status())
            .collect();
        statuses.sort_by(|left, right| left.profile.cmp(&right.profile));
        statuses
    }
}
