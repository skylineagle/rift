use crate::ci::Sample;

pub struct Metric {
    pub name: &'static str,
    pub higher_is_better: bool,
    pub decimals: usize,
    pub read: fn(&Sample) -> Option<f64>,
}

pub const METRICS: [Metric; 2] = [
    Metric {
        name: "throughput MB/s",
        higher_is_better: true,
        decimals: 3,
        read: |sample| Some(sample.throughput_mbps),
    },
    Metric {
        name: "CPU % per MB/s",
        higher_is_better: false,
        decimals: 4,
        read: |sample| sample.cpu_pct_per_mbps,
    },
];

impl Metric {
    pub fn loss(&self, base: f64, head: f64) -> f64 {
        let change = (head - base) / base;
        if self.higher_is_better {
            -change
        } else {
            change
        }
    }
}
