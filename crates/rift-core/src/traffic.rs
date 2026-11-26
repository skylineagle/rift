use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;

use crate::event::Origin;
use crate::side::Side;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct SideTraffic {
    pub received_bytes: u64,
    pub received_chunks: u64,
    pub sent_bytes: u64,
    pub sent_chunks: u64,
    pub injected_bytes: u64,
    pub undelivered_chunks: u64,
}

impl SideTraffic {
    pub fn since(self, earlier: SideTraffic) -> SideTraffic {
        SideTraffic {
            received_bytes: self.received_bytes.saturating_sub(earlier.received_bytes),
            received_chunks: self.received_chunks.saturating_sub(earlier.received_chunks),
            sent_bytes: self.sent_bytes.saturating_sub(earlier.sent_bytes),
            sent_chunks: self.sent_chunks.saturating_sub(earlier.sent_chunks),
            injected_bytes: self.injected_bytes.saturating_sub(earlier.injected_bytes),
            undelivered_chunks: self
                .undelivered_chunks
                .saturating_sub(earlier.undelivered_chunks),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct ProfileTraffic {
    pub a: SideTraffic,
    pub b: SideTraffic,
}

#[derive(Default)]
pub(crate) struct SideCounters {
    received_bytes: AtomicU64,
    received_chunks: AtomicU64,
    sent_bytes: AtomicU64,
    sent_chunks: AtomicU64,
    injected_bytes: AtomicU64,
    undelivered_chunks: AtomicU64,
}

impl SideCounters {
    pub fn record_received(&self, length: usize) {
        add(&self.received_bytes, length as u64);
        add(&self.received_chunks, 1);
    }

    pub fn record_delivered(&self, origin: Origin, length: usize) {
        self.record_injected(origin, length);
        add(&self.sent_bytes, length as u64);
        add(&self.sent_chunks, 1);
    }

    pub fn record_undelivered(&self, origin: Origin, length: usize) {
        self.record_injected(origin, length);
        add(&self.undelivered_chunks, 1);
    }

    fn record_injected(&self, origin: Origin, length: usize) {
        if origin == Origin::Injected {
            add(&self.injected_bytes, length as u64);
        }
    }

    fn snapshot(&self) -> SideTraffic {
        SideTraffic {
            received_bytes: read(&self.received_bytes),
            received_chunks: read(&self.received_chunks),
            sent_bytes: read(&self.sent_bytes),
            sent_chunks: read(&self.sent_chunks),
            injected_bytes: read(&self.injected_bytes),
            undelivered_chunks: read(&self.undelivered_chunks),
        }
    }
}

fn add(counter: &AtomicU64, amount: u64) {
    counter.fetch_add(amount, Ordering::Relaxed);
}

fn read(counter: &AtomicU64) -> u64 {
    counter.load(Ordering::Relaxed)
}

#[derive(Default)]
pub(crate) struct ProfileCounters {
    a: SideCounters,
    b: SideCounters,
}

impl ProfileCounters {
    pub fn side(&self, side: Side) -> &SideCounters {
        match side {
            Side::A => &self.a,
            Side::B => &self.b,
        }
    }

    fn snapshot(&self) -> ProfileTraffic {
        ProfileTraffic {
            a: self.a.snapshot(),
            b: self.b.snapshot(),
        }
    }
}

#[derive(Clone, Default)]
pub struct TrafficRegistry {
    profiles: Arc<Mutex<HashMap<String, Arc<ProfileCounters>>>>,
}

impl TrafficRegistry {
    pub(crate) fn counters(&self, profile: &str) -> Arc<ProfileCounters> {
        let mut profiles = self.profiles.lock().unwrap();
        profiles.entry(profile.to_string()).or_default().clone()
    }

    pub fn snapshot(&self) -> BTreeMap<String, ProfileTraffic> {
        self.profiles
            .lock()
            .unwrap()
            .iter()
            .map(|(profile, counters)| (profile.clone(), counters.snapshot()))
            .collect()
    }
}
