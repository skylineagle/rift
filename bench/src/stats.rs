use hdrhistogram::Histogram;
use serde::Serialize;

use crate::frame::Decoded;

#[derive(Debug, Clone, Default, Serialize)]
pub struct Latency {
    pub mean_us: f64,
    pub p50_us: u64,
    pub p90_us: u64,
    pub p99_us: u64,
    pub p999_us: u64,
    pub max_us: u64,
}

pub struct Window {
    pub frames: u64,
    pub first_ns: Option<u64>,
    pub last_ns: u64,
    latency: Histogram<u64>,
}

impl Window {
    fn new() -> Self {
        Self {
            frames: 0,
            first_ns: None,
            last_ns: 0,
            latency: Histogram::new_with_bounds(1, 600_000_000, 3).unwrap(),
        }
    }

    fn record(&mut self, frame: &Decoded, now: u64) {
        self.frames += 1;
        self.first_ns.get_or_insert(now);
        self.last_ns = now;
        let micros = now.saturating_sub(frame.timestamp) / 1000;
        self.latency.saturating_record(micros.max(1));
    }

    pub fn latency(&self) -> Latency {
        if self.latency.is_empty() {
            return Latency::default();
        }
        Latency {
            mean_us: self.latency.mean(),
            p50_us: self.latency.value_at_quantile(0.5),
            p90_us: self.latency.value_at_quantile(0.9),
            p99_us: self.latency.value_at_quantile(0.99),
            p999_us: self.latency.value_at_quantile(0.999),
            max_us: self.latency.max(),
        }
    }
}

pub struct FlowStats {
    pub total: Window,
    pub interval: Window,
    pub out_of_order: u64,
    pub garbage_bytes: u64,
    pub corrupt_frames: u64,
    highest: Option<u64>,
}

impl Default for FlowStats {
    fn default() -> Self {
        Self {
            total: Window::new(),
            interval: Window::new(),
            out_of_order: 0,
            garbage_bytes: 0,
            corrupt_frames: 0,
            highest: None,
        }
    }
}

impl FlowStats {
    pub fn record(&mut self, frames: &[Decoded], now: u64) {
        for frame in frames {
            match self.highest {
                Some(highest) if frame.sequence <= highest => self.out_of_order += 1,
                _ => self.highest = Some(frame.sequence),
            }
            self.total.record(frame, now);
            self.interval.record(frame, now);
        }
    }

    pub fn take_interval(&mut self) -> Window {
        std::mem::replace(&mut self.interval, Window::new())
    }
}
