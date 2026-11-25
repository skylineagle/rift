use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::channel::{Channel, Progress};
use crate::clock::now_ns;
use crate::frame::{encode, Scanner};
use crate::stats::{FlowStats, Latency};

const STREAM_BATCH_BYTES: usize = 64 * 1024;
const DATAGRAM_BATCH_FRAMES: usize = 32;
const RECEIVE_BUFFER: usize = 256 * 1024;

#[derive(Clone, Copy)]
pub struct SendPlan {
    pub frame_size: usize,
    pub rate_bytes_per_second: Option<f64>,
}

#[derive(Default)]
pub struct SendCounters {
    pub frames: AtomicU64,
    pub retries: AtomicU64,
    pub started_ns: AtomicU64,
    pub stopped_ns: AtomicU64,
    pub error: Mutex<Option<String>>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct FlowResult {
    pub name: String,
    pub frame_size: usize,
    pub sent_frames: u64,
    pub received_frames: u64,
    pub lost_frames: u64,
    pub loss_pct: f64,
    pub out_of_order: u64,
    pub corrupt_frames: u64,
    pub garbage_bytes: u64,
    pub send_retries: u64,
    pub offered_mbps: f64,
    pub goodput_mbps: f64,
    pub latency: Latency,
    pub error: Option<String>,
}

pub struct Flow {
    pub name: String,
    pub plan: SendPlan,
    pub counters: Arc<SendCounters>,
    pub stats: Arc<Mutex<FlowStats>>,
    send_stop: Arc<AtomicBool>,
    receive_stop: Arc<AtomicBool>,
    sender: Option<JoinHandle<()>>,
    receiver: Option<JoinHandle<()>>,
}

impl Flow {
    pub fn start(name: &str, from: Channel, to: Channel, plan: SendPlan) -> Self {
        let mut flow = Self::receive_only(name, to, plan);
        let counters = flow.counters.clone();
        let stop = flow.send_stop.clone();
        flow.sender = Some(std::thread::spawn(move || {
            run_sender(from, plan, &counters, &stop)
        }));
        flow
    }

    pub fn receive_only(name: &str, to: Channel, plan: SendPlan) -> Self {
        let stats = Arc::new(Mutex::new(FlowStats::default()));
        let receive_stop = Arc::new(AtomicBool::new(false));
        let receiver = {
            let stats = stats.clone();
            let stop = receive_stop.clone();
            std::thread::spawn(move || run_receiver(to, plan.frame_size, &stats, &stop))
        };
        Self {
            name: name.to_string(),
            plan,
            counters: Arc::new(SendCounters::default()),
            stats,
            send_stop: Arc::new(AtomicBool::new(false)),
            receive_stop,
            sender: None,
            receiver: Some(receiver),
        }
    }

    pub fn stop_sending(&mut self) {
        self.send_stop.store(true, Ordering::Relaxed);
        if let Some(sender) = self.sender.take() {
            let _ = sender.join();
        }
    }

    pub fn received(&self) -> u64 {
        self.stats.lock().unwrap().total.frames
    }

    pub fn drain(&mut self, quiet_for: Duration, limit: Duration) {
        let deadline = Instant::now() + limit;
        let mut last = self.received();
        let mut quiet_since = Instant::now();
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(50));
            let now = self.received();
            if now != last {
                last = now;
                quiet_since = Instant::now();
            } else if quiet_since.elapsed() >= quiet_for {
                break;
            }
        }
    }

    pub fn finish(mut self) -> FlowResult {
        self.stop_sending();
        self.receive_stop.store(true, Ordering::Relaxed);
        if let Some(receiver) = self.receiver.take() {
            let _ = receiver.join();
        }
        self.result()
    }

    pub fn result(&self) -> FlowResult {
        let stats = self.stats.lock().unwrap();
        let counters = &self.counters;
        let sent = counters.frames.load(Ordering::Relaxed);
        let received = stats.total.frames;
        let lost = sent.saturating_sub(received);
        let size = self.plan.frame_size as f64;
        let started = counters.started_ns.load(Ordering::Relaxed);
        let stopped = counters.stopped_ns.load(Ordering::Relaxed);
        let send_seconds = stopped.saturating_sub(started).max(1) as f64 / 1e9;
        let receive_seconds = stats.total.last_ns.saturating_sub(started).max(1) as f64 / 1e9;
        FlowResult {
            name: self.name.clone(),
            frame_size: self.plan.frame_size,
            sent_frames: sent,
            received_frames: received,
            lost_frames: lost,
            loss_pct: if sent == 0 { 0.0 } else { lost as f64 / sent as f64 * 100.0 },
            out_of_order: stats.out_of_order,
            corrupt_frames: stats.corrupt_frames,
            garbage_bytes: stats.garbage_bytes,
            send_retries: counters.retries.load(Ordering::Relaxed),
            offered_mbps: sent as f64 * size / send_seconds / 1e6,
            goodput_mbps: received as f64 * size / receive_seconds / 1e6,
            latency: stats.total.latency(),
            error: counters.error.lock().unwrap().clone(),
        }
    }
}

pub struct Pacer {
    started: Instant,
    rate: Option<f64>,
    frame_size: f64,
}

impl Pacer {
    pub fn new(plan: SendPlan) -> Self {
        Self {
            started: Instant::now(),
            rate: plan.rate_bytes_per_second,
            frame_size: plan.frame_size as f64,
        }
    }

    pub fn ready(&self, sent: u64, batch: usize) -> usize {
        match self.rate {
            None => batch,
            Some(rate) => {
                let due = (rate * self.started.elapsed().as_secs_f64() / self.frame_size) as u64;
                due.saturating_sub(sent).min(batch as u64) as usize
            }
        }
    }
}

pub fn batch_frames(channel: &Channel, frame_size: usize) -> usize {
    if channel.is_stream() {
        (STREAM_BATCH_BYTES / frame_size).max(1)
    } else {
        DATAGRAM_BATCH_FRAMES
    }
}

pub fn fill(buffer: &mut [u8], frame_size: usize, first_sequence: u64, count: usize) {
    let timestamp = now_ns();
    for index in 0..count {
        let frame = &mut buffer[index * frame_size..(index + 1) * frame_size];
        encode(frame, first_sequence + index as u64, timestamp);
    }
}

fn run_sender(mut channel: Channel, plan: SendPlan, counters: &SendCounters, stop: &AtomicBool) {
    let size = plan.frame_size;
    let batch = batch_frames(&channel, size);
    let mut buffer = vec![0u8; batch * size];
    let pacer = Pacer::new(plan);
    let progress = Progress {
        stop,
        retries: &counters.retries,
    };
    let mut sent = 0u64;
    counters.started_ns.store(now_ns(), Ordering::Relaxed);
    while !stop.load(Ordering::Relaxed) {
        let count = pacer.ready(sent, batch);
        if count == 0 {
            std::thread::sleep(Duration::from_micros(100));
            continue;
        }
        fill(&mut buffer, size, sent, count);
        let outcome = channel.write_frames(&buffer[..count * size], size, &progress);
        sent += count as u64;
        counters.frames.store(sent, Ordering::Relaxed);
        match outcome {
            Ok(true) => {}
            Ok(false) => break,
            Err(error) => {
                *counters.error.lock().unwrap() = Some(error.to_string());
                break;
            }
        }
    }
    counters.stopped_ns.store(now_ns(), Ordering::Relaxed);
}

fn run_receiver(mut channel: Channel, frame_size: usize, stats: &Mutex<FlowStats>, stop: &AtomicBool) {
    let mut buffer = vec![0u8; RECEIVE_BUFFER];
    let mut scanner = Scanner::new(frame_size);
    let mut frames = Vec::with_capacity(1024);
    while !stop.load(Ordering::Relaxed) {
        match channel.read(&mut buffer) {
            Ok(Some(0)) if channel.is_stream() => std::thread::sleep(Duration::from_millis(5)),
            Ok(Some(count)) => {
                frames.clear();
                scanner.feed(&buffer[..count], &mut frames);
                let now = now_ns();
                let mut stats = stats.lock().unwrap();
                stats.record(&frames, now);
                stats.garbage_bytes = scanner.garbage_bytes;
                stats.corrupt_frames = scanner.corrupt_frames;
            }
            Ok(None) => {}
            Err(_) => std::thread::sleep(Duration::from_millis(5)),
        }
    }
}
