use std::collections::{HashMap, VecDeque};

use chrono::{DateTime, Utc};
use rift_core::{Event, Origin, Side};
use serde::Serialize;

const MAX_ROWS: usize = 500;
const MAX_PAYLOAD_BYTES: usize = 4 << 20;

#[derive(PartialEq, Eq, Hash)]
struct SkipKey {
    profile: String,
    source: Side,
    target: Side,
    origin: Origin,
    delivered: bool,
}

#[derive(Serialize)]
struct Skipped {
    profile: String,
    timestamp: DateTime<Utc>,
    source: Side,
    target: Side,
    origin: Origin,
    delivered: bool,
    chunks: u64,
    length: usize,
}

#[derive(Serialize)]
struct Row {
    event: Event,
    length: usize,
}

#[derive(Serialize)]
struct Header {
    rows: Vec<Row>,
    skipped: Vec<Skipped>,
    lagged: u64,
}

#[derive(Default)]
pub struct EventBatch {
    events: VecDeque<Event>,
    data_rows: usize,
    payload_bytes: usize,
    skipped: HashMap<SkipKey, Skipped>,
    lagged: u64,
}

impl EventBatch {
    pub fn is_empty(&self) -> bool {
        self.events.is_empty() && self.skipped.is_empty() && self.lagged == 0
    }

    pub fn lagged(&mut self, events: u64) {
        self.lagged += events;
    }

    pub fn push(&mut self, event: Event) {
        if let Event::Data { bytes, .. } = &event {
            self.data_rows += 1;
            self.payload_bytes += bytes.len();
        }
        self.events.push_back(event);
        while self.data_rows > MAX_ROWS || self.payload_bytes > MAX_PAYLOAD_BYTES {
            self.skip_oldest_data();
        }
    }

    fn skip_oldest_data(&mut self) {
        let Some(index) = self
            .events
            .iter()
            .position(|event| matches!(event, Event::Data { .. }))
        else {
            return;
        };
        let Some(Event::Data {
            profile,
            timestamp,
            source,
            target,
            origin,
            bytes,
            delivered,
            ..
        }) = self.events.remove(index)
        else {
            return;
        };
        self.data_rows -= 1;
        self.payload_bytes -= bytes.len();
        let key = SkipKey {
            profile: profile.clone(),
            source,
            target,
            origin,
            delivered,
        };
        let skipped = self.skipped.entry(key).or_insert(Skipped {
            profile,
            timestamp,
            source,
            target,
            origin,
            delivered,
            chunks: 0,
            length: 0,
        });
        skipped.timestamp = timestamp;
        skipped.chunks += 1;
        skipped.length += bytes.len();
    }

    pub fn encode(self) -> Vec<u8> {
        let mut payload = Vec::with_capacity(self.payload_bytes);
        let rows = self
            .events
            .into_iter()
            .map(|mut event| {
                let length = match &mut event {
                    Event::Data { bytes, .. } => {
                        payload.extend_from_slice(bytes);
                        let length = bytes.len();
                        *bytes = Vec::new();
                        length
                    }
                    _ => 0,
                };
                Row { event, length }
            })
            .collect();
        let header = Header {
            rows,
            skipped: self.skipped.into_values().collect(),
            lagged: self.lagged,
        };
        let header = serde_json::to_vec(&header).unwrap_or_default();
        let mut frame = Vec::with_capacity(4 + header.len() + payload.len());
        frame.extend_from_slice(&(header.len() as u32).to_le_bytes());
        frame.extend_from_slice(&header);
        frame.extend_from_slice(&payload);
        frame
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn data(size: usize) -> Event {
        Event::data(
            "p",
            Side::A,
            Side::B,
            Origin::Received,
            &vec![7; size],
            true,
        )
    }

    #[test]
    fn over_the_row_cap_the_oldest_data_is_folded_into_skipped() {
        let mut batch = EventBatch::default();
        batch.push(Event::status(
            "p",
            Side::A,
            rift_core::ConnectionState::Listening,
        ));
        for _ in 0..MAX_ROWS + 3 {
            batch.push(data(10));
        }
        assert_eq!(batch.data_rows, MAX_ROWS);
        assert!(matches!(batch.events.front(), Some(Event::Status { .. })));
        let skipped: Vec<&Skipped> = batch.skipped.values().collect();
        assert_eq!((skipped[0].chunks, skipped[0].length), (3, 30));
    }

    #[test]
    fn frame_is_header_length_then_header_then_payloads() {
        let mut batch = EventBatch::default();
        batch.push(data(3));
        batch.push(data(2));
        let frame = batch.encode();
        let header_length = u32::from_le_bytes(frame[..4].try_into().unwrap()) as usize;
        let header: serde_json::Value =
            serde_json::from_slice(&frame[4..4 + header_length]).unwrap();
        assert_eq!(header["rows"][0]["length"], 3);
        assert_eq!(header["rows"][1]["length"], 2);
        assert_eq!(&frame[4 + header_length..], &[7, 7, 7, 7, 7]);
    }
}
