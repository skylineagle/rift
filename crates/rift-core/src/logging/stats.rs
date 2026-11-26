use std::collections::HashMap;
use std::time::Duration;

use serde::Serialize;

use super::record::LogRecord;
use crate::event::{Event, Origin};
use crate::side::Side;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
struct SideCounters {
    received_bytes: u64,
    received_chunks: u64,
    sent_bytes: u64,
    sent_chunks: u64,
    injected_bytes: u64,
    undelivered_chunks: u64,
}

#[derive(Debug, Clone, Default)]
struct ProfileCounters {
    a: SideCounters,
    b: SideCounters,
}

impl ProfileCounters {
    fn side(&mut self, side: Side) -> &mut SideCounters {
        match side {
            Side::A => &mut self.a,
            Side::B => &mut self.b,
        }
    }
}

#[derive(Default)]
pub(super) struct Statistics {
    profiles: HashMap<String, ProfileCounters>,
}

impl Statistics {
    pub fn observe(&mut self, event: &Event) {
        let Event::Data {
            profile,
            source,
            target,
            origin,
            bytes,
            delivered,
            ..
        } = event
        else {
            return;
        };
        let counters = self.profiles.entry(profile.clone()).or_default();
        let length = bytes.len() as u64;
        if *origin == Origin::Received {
            let side = counters.side(*source);
            side.received_bytes += length;
            side.received_chunks += 1;
            return;
        }
        let side = counters.side(*target);
        if *origin == Origin::Injected {
            side.injected_bytes += length;
        }
        if *delivered {
            side.sent_bytes += length;
            side.sent_chunks += 1;
        } else {
            side.undelivered_chunks += 1;
        }
    }

    pub fn report(&mut self, running: &[String], interval: Duration) -> Vec<LogRecord> {
        let mut counted = std::mem::take(&mut self.profiles);
        running
            .iter()
            .map(|profile| {
                let counters = counted.remove(profile).unwrap_or_default();
                LogRecord::info("stats.profile", format!("{profile} statistics"))
                    .profile(profile)
                    .field("interval_secs", interval.as_secs())
                    .field("a", counters.a)
                    .field("b", counters.b)
            })
            .collect()
    }

    pub fn reset(&mut self) {
        self.profiles.clear();
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn data(origin: Origin, delivered: bool) -> Event {
        Event::data("gps", Side::A, Side::B, origin, b"abc", delivered)
    }

    #[test]
    fn counts_each_origin_on_the_matching_side_and_resets() {
        let mut statistics = Statistics::default();
        statistics.observe(&data(Origin::Received, true));
        statistics.observe(&data(Origin::Forwarded, true));
        statistics.observe(&data(Origin::Injected, true));
        statistics.observe(&data(Origin::Injected, false));
        let running = ["gps".to_string()];
        let records = statistics.report(&running, Duration::from_secs(60));
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].fields["interval_secs"], 60);
        assert_eq!(
            records[0].fields["a"],
            json!({"received_bytes": 3, "received_chunks": 1, "sent_bytes": 0, "sent_chunks": 0, "injected_bytes": 0, "undelivered_chunks": 0})
        );
        assert_eq!(
            records[0].fields["b"],
            json!({"received_bytes": 0, "received_chunks": 0, "sent_bytes": 6, "sent_chunks": 2, "injected_bytes": 6, "undelivered_chunks": 1})
        );
        let next = statistics.report(&running, Duration::from_secs(60));
        assert_eq!(next[0].fields["b"]["sent_bytes"], 0);
    }

    #[test]
    fn stopped_profiles_are_not_reported() {
        let mut statistics = Statistics::default();
        statistics.observe(&data(Origin::Received, true));
        assert!(statistics.report(&[], Duration::from_secs(1)).is_empty());
    }
}
