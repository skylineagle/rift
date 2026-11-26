use std::time::Duration;

use tokio::sync::broadcast::{self, error::RecvError};
use tokio::time::{Instant, MissedTickBehavior};

use super::logger::Logger;
use super::record::LogRecord;
use super::stats::Statistics;
use crate::event::{ConnectionState, Event};
use crate::side::Side;
use crate::traffic::TrafficRegistry;

const STATS_CHECK_PERIOD: Duration = Duration::from_secs(1);

impl Logger {
    pub async fn watch(self, mut lifecycle: broadcast::Receiver<Event>, traffic: TrafficRegistry) {
        let mut statistics = Statistics::default();
        let mut reported = Instant::now();
        let mut ticks = tokio::time::interval(STATS_CHECK_PERIOD);
        ticks.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                received = lifecycle.recv() => match received {
                    Ok(event) => {
                        if let Some(record) = event_record(&event) {
                            self.log(record);
                        }
                    }
                    Err(RecvError::Lagged(_)) => {}
                    Err(RecvError::Closed) => break,
                },
                _ = ticks.tick() => match self.stats_interval() {
                    Some(interval) if reported.elapsed() >= interval => {
                        for record in statistics.report(
                            &self.running_profiles(),
                            traffic.snapshot(),
                            interval,
                        ) {
                            self.log(record);
                        }
                        reported = Instant::now();
                    }
                    Some(_) => {}
                    None => {
                        statistics.rebase(traffic.snapshot());
                        reported = Instant::now();
                    }
                },
            }
        }
    }
}

fn event_record(event: &Event) -> Option<LogRecord> {
    match event {
        Event::Status {
            profile,
            side,
            state,
            ..
        } => status_record(profile, *side, state),
        Event::Dropped {
            profile,
            side,
            peer,
            chunks,
            ..
        } => Some(dropped_record(profile, *side, peer.as_deref(), *chunks)),
        Event::Data { .. } | Event::Workflow { .. } => None,
    }
}

fn status_record(profile: &str, side: Side, state: &ConnectionState) -> Option<LogRecord> {
    let message = format!("{profile} {side} {state}");
    let record = match state {
        ConnectionState::Disabled => return None,
        ConnectionState::Listening => LogRecord::debug("side.listening", message),
        ConnectionState::Connecting => LogRecord::debug("side.connecting", message),
        ConnectionState::Connected { peer } => {
            LogRecord::info("side.connected", message).field("peer", peer)
        }
        ConnectionState::Disconnected { peer } => {
            let record = LogRecord::info("side.disconnected", message);
            match peer {
                Some(peer) => record.field("peer", peer),
                None => record,
            }
        }
        ConnectionState::Error { .. } => LogRecord::error("side.error", message),
    };
    Some(record.profile(profile).side(side))
}

fn dropped_record(profile: &str, side: Side, peer: Option<&str>, chunks: u64) -> LogRecord {
    let record = LogRecord::warn(
        "data.dropped",
        format!("{profile} {side} dropped {chunks} chunks"),
    )
    .profile(profile)
    .side(side)
    .field("chunks", chunks);
    match peer {
        Some(peer) => record.field("peer", peer),
        None => record,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::event::Origin;
    use crate::logging::{FileSinkConfig, LogLevel, LoggingConfig};

    #[test]
    fn status_events_map_to_named_records() {
        let connected = Event::status(
            "gps",
            Side::A,
            ConnectionState::Connected {
                peer: "10.0.0.5:1".into(),
            },
        );
        let record = event_record(&connected).unwrap();
        assert_eq!(record.event, "side.connected");
        assert_eq!(record.level, LogLevel::Info);
        assert_eq!(record.message, "gps A connected 10.0.0.5:1");
        assert_eq!(record.fields["peer"], "10.0.0.5:1");
        let failed = Event::status(
            "gps",
            Side::B,
            ConnectionState::Error {
                message: "boom".into(),
            },
        );
        assert_eq!(event_record(&failed).unwrap().level, LogLevel::Error);
        let disabled = Event::status("gps", Side::B, ConnectionState::Disabled);
        assert!(event_record(&disabled).is_none());
    }

    #[test]
    fn only_drops_and_status_changes_produce_records() {
        let received = Event::data("gps", Side::A, Side::B, Origin::Received, b"x", true);
        assert!(event_record(&received).is_none());
        let dropped = event_record(&Event::dropped("gps", Side::A, None, 4)).unwrap();
        assert_eq!(dropped.event, "data.dropped");
        assert_eq!(dropped.fields["chunks"], 4);
    }

    #[tokio::test(start_paused = true)]
    async fn reports_statistics_using_the_live_interval() {
        let directory = tempfile::tempdir().unwrap();
        let mut config = LoggingConfig {
            stats_interval_secs: 0,
            file: FileSinkConfig {
                enabled: true,
                directory: Some(directory.path().to_path_buf()),
                ..FileSinkConfig::default()
            },
            ..LoggingConfig::default()
        };
        let logger = Logger::new(config.clone());
        let (events, received) = broadcast::channel(8);
        let traffic = TrafficRegistry::default();
        let watcher = tokio::spawn(logger.clone().watch(received, traffic.clone()));
        logger.log(LogRecord::info("profile.started", "started").profile("gps"));
        tokio::time::sleep(Duration::from_secs(30)).await;
        config.stats_interval_secs = 10;
        logger.reconfigure(config);
        traffic.counters("gps").side(Side::A).record_received(3);
        tokio::time::sleep(Duration::from_millis(11_500)).await;
        drop(events);
        watcher.await.unwrap();
        logger.flush();
        let written = fs::read_to_string(directory.path().join("rift.log")).unwrap();
        assert_eq!(written.matches("stats.profile").count(), 1);
        assert!(written.contains("\"received_bytes\":3"));
    }
}
