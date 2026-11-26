use std::collections::BTreeMap;
use std::time::Duration;

use super::record::LogRecord;
use crate::traffic::ProfileTraffic;

#[derive(Default)]
pub(super) struct Statistics {
    reported: BTreeMap<String, ProfileTraffic>,
}

impl Statistics {
    pub fn report(
        &mut self,
        running: &[String],
        current: BTreeMap<String, ProfileTraffic>,
        interval: Duration,
    ) -> Vec<LogRecord> {
        let records = running
            .iter()
            .map(|profile| self.record(profile, &current, interval))
            .collect();
        self.rebase(current);
        records
    }

    pub fn rebase(&mut self, current: BTreeMap<String, ProfileTraffic>) {
        self.reported = current;
    }

    fn record(
        &self,
        profile: &str,
        current: &BTreeMap<String, ProfileTraffic>,
        interval: Duration,
    ) -> LogRecord {
        let total = current.get(profile).copied().unwrap_or_default();
        let earlier = self.reported.get(profile).copied().unwrap_or_default();
        LogRecord::info("stats.profile", format!("{profile} statistics"))
            .profile(profile)
            .field("interval_secs", interval.as_secs())
            .field("a", total.a.since(earlier.a))
            .field("b", total.b.since(earlier.b))
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::event::Origin;
    use crate::side::Side;
    use crate::traffic::TrafficRegistry;

    #[test]
    fn reports_counter_deltas_since_the_previous_report() {
        let registry = TrafficRegistry::default();
        let counters = registry.counters("gps");
        counters.side(Side::A).record_received(3);
        counters
            .side(Side::B)
            .record_delivered(Origin::Forwarded, 3);
        counters.side(Side::B).record_delivered(Origin::Injected, 3);
        counters
            .side(Side::B)
            .record_undelivered(Origin::Injected, 3);
        let mut statistics = Statistics::default();
        let running = ["gps".to_string()];
        let records = statistics.report(&running, registry.snapshot(), Duration::from_secs(60));
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
        registry
            .counters("gps")
            .side(Side::B)
            .record_delivered(Origin::Forwarded, 5);
        let next = statistics.report(&running, registry.snapshot(), Duration::from_secs(60));
        assert_eq!(next[0].fields["a"]["received_bytes"], 0);
        assert_eq!(next[0].fields["b"]["sent_bytes"], 5);
    }

    #[test]
    fn stopped_profiles_are_not_reported() {
        let registry = TrafficRegistry::default();
        registry.counters("gps").side(Side::A).record_received(3);
        let mut statistics = Statistics::default();
        assert!(statistics
            .report(&[], registry.snapshot(), Duration::from_secs(1))
            .is_empty());
    }
}
