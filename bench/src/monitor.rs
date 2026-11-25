#![allow(deprecated)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::Serialize;

use crate::clock::now_ns;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Sample {
    pub at_ns: u64,
    pub rss_bytes: u64,
    pub cpu_ns: u64,
    pub threads: i32,
    pub open_files: i32,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Usage {
    pub rss_start_mb: f64,
    pub rss_peak_mb: f64,
    pub rss_end_mb: f64,
    pub cpu_avg_pct: f64,
    pub cpu_peak_pct: f64,
    pub threads: i32,
    pub open_files: i32,
}

#[cfg(target_os = "macos")]
fn timebase() -> (u64, u64) {
    let mut info = libc::mach_timebase_info { numer: 0, denom: 0 };
    unsafe {
        libc::mach_timebase_info(&mut info);
    }
    (info.numer as u64, info.denom.max(1) as u64)
}

#[cfg(target_os = "macos")]
pub fn sample(pid: i32) -> Option<Sample> {
    let mut info: libc::proc_taskinfo = unsafe { std::mem::zeroed() };
    let size = std::mem::size_of::<libc::proc_taskinfo>() as libc::c_int;
    let read = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDTASKINFO,
            0,
            &mut info as *mut _ as *mut libc::c_void,
            size,
        )
    };
    if read != size {
        return None;
    }
    let files_bytes =
        unsafe { libc::proc_pidinfo(pid, libc::PROC_PIDLISTFDS, 0, std::ptr::null_mut(), 0) };
    let (numer, denom) = timebase();
    let ticks = info.pti_total_user + info.pti_total_system;
    Some(Sample {
        at_ns: now_ns(),
        rss_bytes: info.pti_resident_size,
        cpu_ns: ticks * numer / denom,
        threads: info.pti_threadnum,
        open_files: files_bytes / 8,
    })
}

#[cfg(target_os = "linux")]
pub fn sample(pid: i32) -> Option<Sample> {
    let status = std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    let field = |name: &str| -> Option<u64> {
        status
            .lines()
            .find(|line| line.starts_with(name))?
            .split_whitespace()
            .nth(1)?
            .parse()
            .ok()
    };
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let after_name = &stat[stat.rfind(')')? + 2..];
    let fields: Vec<&str> = after_name.split_whitespace().collect();
    let ticks: u64 = fields.get(11)?.parse::<u64>().ok()? + fields.get(12)?.parse::<u64>().ok()?;
    let per_second = unsafe { libc::sysconf(libc::_SC_CLK_TCK) }.max(1) as u64;
    let open_files = std::fs::read_dir(format!("/proc/{pid}/fd")).ok()?.count() as i32;
    Some(Sample {
        at_ns: now_ns(),
        rss_bytes: field("VmRSS:")? * 1024,
        cpu_ns: ticks * 1_000_000_000 / per_second,
        threads: field("Threads:")? as i32,
        open_files,
    })
}

pub struct Monitor {
    samples: Arc<Mutex<Vec<Sample>>>,
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl Monitor {
    pub fn start(pid: i32, every: Duration) -> Self {
        let samples = Arc::new(Mutex::new(Vec::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let handle = {
            let samples = samples.clone();
            let stop = stop.clone();
            std::thread::spawn(move || {
                while !stop.load(Ordering::Relaxed) {
                    if let Some(sample) = sample(pid) {
                        samples.lock().unwrap().push(sample);
                    }
                    std::thread::sleep(every);
                }
            })
        };
        Self {
            samples,
            stop,
            handle: Some(handle),
        }
    }

    pub fn samples(&self) -> Vec<Sample> {
        self.samples.lock().unwrap().clone()
    }

    pub fn finish(mut self) -> Vec<Sample> {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        self.samples()
    }
}

fn megabytes(bytes: u64) -> f64 {
    bytes as f64 / 1_048_576.0
}

fn cpu_percent(from: &Sample, to: &Sample) -> f64 {
    let elapsed = to.at_ns.saturating_sub(from.at_ns).max(1) as f64;
    to.cpu_ns.saturating_sub(from.cpu_ns) as f64 / elapsed * 100.0
}

pub fn summarize(samples: &[Sample], from_ns: u64, to_ns: u64) -> Usage {
    let window: Vec<&Sample> = samples
        .iter()
        .filter(|sample| sample.at_ns >= from_ns && sample.at_ns <= to_ns)
        .collect();
    let (Some(first), Some(last)) = (window.first(), window.last()) else {
        return Usage::default();
    };
    let peak_cpu = window
        .windows(2)
        .map(|pair| cpu_percent(pair[0], pair[1]))
        .fold(0.0, f64::max);
    Usage {
        rss_start_mb: megabytes(samples.first().map_or(0, |sample| sample.rss_bytes)),
        rss_peak_mb: megabytes(window.iter().map(|sample| sample.rss_bytes).max().unwrap_or(0)),
        rss_end_mb: megabytes(last.rss_bytes),
        cpu_avg_pct: cpu_percent(first, last),
        cpu_peak_pct: peak_cpu,
        threads: last.threads,
        open_files: last.open_files,
    }
}
