use std::fs::{self, File};
use std::io::Write;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{bail, Result};
use serde::Serialize;

use crate::channel::{prepare_stream, Progress};
use crate::clock::now_ns;
use crate::flow::{fill, Flow, FlowResult, SendCounters, SendPlan};
use crate::kind::Kind;
use crate::monitor::{sample, summarize, Monitor, Sample, Usage};
use crate::rift::{side_key, Output, RiftProcess};
use crate::sides::{connect_with_retry, prepare, Prepared};

#[derive(clap::Args)]
pub struct SoakArguments {
    #[arg(long, default_value_t = 60.0)]
    minutes: f64,
    #[arg(long, default_value = "results")]
    out: PathBuf,
    #[arg(long, default_value_t = 200.0)]
    tcp_rate: f64,
    #[arg(long, default_value_t = 50.0)]
    udp_rate: f64,
    #[arg(long, default_value_t = 2.0)]
    serial_rate: f64,
    #[arg(long, default_value_t = 5.0)]
    interval_seconds: f64,
    #[arg(long, default_value_t = 1.0)]
    churn_seconds: f64,
    #[arg(long, default_value_t = 1_048_576)]
    churn_bytes: usize,
    #[arg(long)]
    serial: bool,
}

struct ProfilePlan {
    name: &'static str,
    a: Kind,
    b: Kind,
    rate: f64,
    churn: bool,
}

#[derive(Serialize)]
struct TickFlow {
    name: String,
    mbps: f64,
    sent_total: u64,
    received_total: u64,
    lost_total: u64,
    corrupt_total: u64,
    p50_us: u64,
    p99_us: u64,
    max_us: u64,
}

#[derive(Serialize)]
struct TickUsage {
    rss_mb: f64,
    cpu_pct: f64,
    threads: i32,
    open_files: i32,
}

#[derive(Serialize)]
struct Tick {
    kind: &'static str,
    elapsed_s: f64,
    rift: TickUsage,
    flows: Vec<TickFlow>,
    dropped_chunks: u64,
    errors: usize,
}

#[derive(Serialize)]
struct Final {
    kind: &'static str,
    minutes: f64,
    survived: bool,
    flows: Vec<FlowResult>,
    rift: Usage,
    dropped_chunks: u64,
    errors: Vec<String>,
    config: String,
}

fn plans(arguments: &SoakArguments) -> Vec<ProfilePlan> {
    let plans = vec![
        ProfilePlan { name: "tcp", a: Kind::TcpServer, b: Kind::TcpClient, rate: arguments.tcp_rate, churn: false },
        ProfilePlan { name: "udp", a: Kind::UdpServer, b: Kind::UdpClient, rate: arguments.udp_rate, churn: false },
        ProfilePlan { name: "udp-tcp", a: Kind::UdpServer, b: Kind::TcpClient, rate: arguments.udp_rate, churn: false },
        ProfilePlan { name: "serial", a: Kind::Uart, b: Kind::TcpServer, rate: arguments.serial_rate, churn: false },
        ProfilePlan { name: "churn", a: Kind::TcpServer, b: Kind::TcpClient, rate: arguments.tcp_rate, churn: true },
    ];
    plans
        .into_iter()
        .filter(|plan| arguments.serial || plan.a != Kind::Uart)
        .collect()
}

struct ProfileSetup {
    plan: ProfilePlan,
    a: Prepared,
    b: Prepared,
}

fn config_toml(profiles: &[ProfileSetup]) -> String {
    profiles
        .iter()
        .map(|profile| {
            format!(
                "[[profile]]\nname = \"{}\"\na = {}\nb = {}\n",
                profile.plan.name, profile.a.toml, profile.b.toml
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_listener(kind: Kind) -> bool {
    matches!(kind, Kind::TcpServer | Kind::UdpServer)
}

pub fn run(rift: &Path, arguments: SoakArguments) -> Result<()> {
    fs::create_dir_all(&arguments.out)?;
    let mut profiles = Vec::new();
    for plan in plans(&arguments) {
        let a = prepare(plan.a)?;
        let b = prepare(plan.b)?;
        profiles.push(ProfileSetup { plan, a, b });
    }
    let config = config_toml(&profiles);
    let config_path = arguments.out.join("soak.toml");
    fs::write(&config_path, &config)?;
    let process = RiftProcess::spawn(
        rift,
        &["run".to_string(), "-c".to_string(), config_path.display().to_string(), "--all".to_string()],
        Output::Parsed,
    )?;
    let monitor = Monitor::start(process.pid, Duration::from_secs(1));
    let listening = process.wait_for(Duration::from_secs(10), |log| {
        profiles.iter().all(|profile| {
            [("A", profile.plan.a), ("B", profile.plan.b)].iter().all(|(side, kind)| {
                !is_listener(*kind)
                    || log.get(&side_key(profile.plan.name, side)).is_some_and(|entry| entry.listening)
            })
        })
    });
    if !listening {
        process.stop();
        bail!("rift did not start listening on every side");
    }
    let mut flows = Vec::new();
    let mut keep_alive = Vec::new();
    let mut churners = Vec::new();
    let stop_churn = Arc::new(AtomicBool::new(false));
    for profile in profiles {
        let plan = SendPlan {
            frame_size: 1024,
            rate_bytes_per_second: Some(profile.plan.rate * 1e6),
        };
        let name = profile.plan.name;
        if profile.plan.churn {
            let address = profile.a.connect_address().expect("churn side is a tcp server");
            let b = profile.b.connect(Duration::from_secs(10))?;
            let flow = Flow::receive_only(&format!("{name} a->b"), b.channel.try_clone()?, plan);
            let counters = flow.counters.clone();
            let stop = stop_churn.clone();
            let every = Duration::from_secs_f64(arguments.churn_seconds);
            let bytes = arguments.churn_bytes;
            churners.push(std::thread::spawn(move || churn(address, plan, &counters, &stop, every, bytes)));
            keep_alive.push(b);
            flows.push(flow);
            continue;
        }
        let a = profile.a.connect(Duration::from_secs(10))?;
        let b = profile.b.connect(Duration::from_secs(10))?;
        flows.push(Flow::start(&format!("{name} a->b"), a.channel.try_clone()?, b.channel.try_clone()?, plan));
        flows.push(Flow::start(&format!("{name} b->a"), b.channel.try_clone()?, a.channel.try_clone()?, plan));
        keep_alive.push(a);
        keep_alive.push(b);
    }
    flows.push(control_flow(arguments.tcp_rate)?);
    let mut output = File::create(arguments.out.join("soak.jsonl"))?;
    let started = now_ns();
    let began = Instant::now();
    let total = Duration::from_secs_f64(arguments.minutes * 60.0);
    let interval = Duration::from_secs_f64(arguments.interval_seconds);
    let mut previous: Option<Sample> = sample(process.pid);
    let mut survived = true;
    let mut process = process;
    while began.elapsed() < total {
        std::thread::sleep(interval);
        if !process.is_running() {
            survived = false;
            break;
        }
        let current = sample(process.pid);
        let tick = build_tick(&flows, &process, previous.as_ref(), current.as_ref(), began.elapsed(), interval);
        writeln!(output, "{}", serde_json::to_string(&tick)?)?;
        output.flush()?;
        eprintln!("{}", summary_line(&tick));
        previous = current;
    }
    stop_churn.store(true, Ordering::Relaxed);
    for churner in churners {
        let _ = churner.join();
    }
    for flow in &mut flows {
        flow.stop_sending();
    }
    for flow in &mut flows {
        flow.drain(Duration::from_millis(500), Duration::from_secs(10));
    }
    let finished = now_ns();
    let results: Vec<FlowResult> = flows.into_iter().map(Flow::finish).collect();
    let log = process.snapshot();
    process.stop();
    let samples = monitor.finish();
    drop(keep_alive);
    let final_record = Final {
        kind: "final",
        minutes: arguments.minutes,
        survived,
        flows: results,
        rift: summarize(&samples, started, finished),
        dropped_chunks: log.values().map(|entry| entry.dropped_chunks).sum(),
        errors: log.values().flat_map(|entry| entry.errors.clone()).collect(),
        config,
    };
    writeln!(output, "{}", serde_json::to_string(&final_record)?)?;
    let samples_file = File::create(arguments.out.join("soak-samples.json"))?;
    serde_json::to_writer(samples_file, &samples)?;
    Ok(())
}

fn control_flow(rate: f64) -> Result<Flow> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let client = TcpStream::connect(listener.local_addr()?)?;
    let (server, _) = listener.accept()?;
    let plan = SendPlan {
        frame_size: 1024,
        rate_bytes_per_second: Some(rate * 1e6),
    };
    Ok(Flow::start("control direct", prepare_stream(client)?, prepare_stream(server)?, plan))
}

fn build_tick(
    flows: &[Flow],
    process: &RiftProcess,
    previous: Option<&Sample>,
    current: Option<&Sample>,
    elapsed: Duration,
    interval: Duration,
) -> Tick {
    let seconds = interval.as_secs_f64();
    let flows = flows
        .iter()
        .map(|flow| {
            let mut stats = flow.stats.lock().unwrap();
            let window = stats.take_interval();
            let latency = window.latency();
            let sent = flow.counters.frames.load(Ordering::Relaxed);
            let received = stats.total.frames;
            TickFlow {
                name: flow.name.clone(),
                mbps: window.frames as f64 * flow.plan.frame_size as f64 / seconds / 1e6,
                sent_total: sent,
                received_total: received,
                lost_total: sent.saturating_sub(received),
                corrupt_total: stats.corrupt_frames,
                p50_us: latency.p50_us,
                p99_us: latency.p99_us,
                max_us: latency.max_us,
            }
        })
        .collect();
    let usage = match (previous, current) {
        (Some(before), Some(now)) => TickUsage {
            rss_mb: now.rss_bytes as f64 / 1_048_576.0,
            cpu_pct: now.cpu_ns.saturating_sub(before.cpu_ns) as f64
                / now.at_ns.saturating_sub(before.at_ns).max(1) as f64
                * 100.0,
            threads: now.threads,
            open_files: now.open_files,
        },
        _ => TickUsage { rss_mb: 0.0, cpu_pct: 0.0, threads: 0, open_files: 0 },
    };
    let log = process.snapshot();
    Tick {
        kind: "tick",
        elapsed_s: elapsed.as_secs_f64(),
        rift: usage,
        flows,
        dropped_chunks: log.values().map(|entry| entry.dropped_chunks).sum(),
        errors: log.values().map(|entry| entry.errors.len()).sum(),
    }
}

fn summary_line(tick: &Tick) -> String {
    let total: f64 = tick.flows.iter().map(|flow| flow.mbps).sum();
    let lost: u64 = tick.flows.iter().map(|flow| flow.lost_total).sum();
    format!(
        "t={:.0}s total {:.1}MB/s lost {} rss {:.1}MB cpu {:.0}% threads {} fds {} dropped {}",
        tick.elapsed_s, total, lost, tick.rift.rss_mb, tick.rift.cpu_pct, tick.rift.threads, tick.rift.open_files, tick.dropped_chunks
    )
}

fn churn(
    address: SocketAddr,
    plan: SendPlan,
    counters: &SendCounters,
    stop: &AtomicBool,
    every: Duration,
    bytes: usize,
) {
    let size = plan.frame_size;
    let frames = (bytes / size).max(1);
    let mut buffer = vec![0u8; frames * size];
    let mut sent = 0u64;
    counters.started_ns.store(now_ns(), Ordering::Relaxed);
    let progress = Progress { stop, retries: &counters.retries };
    while !stop.load(Ordering::Relaxed) {
        let round = Instant::now();
        let deadline = Instant::now() + Duration::from_secs(2);
        match connect_with_retry(address, deadline).and_then(|stream| Ok(prepare_stream(stream)?)) {
            Ok(mut channel) => {
                fill(&mut buffer, size, sent, frames);
                if channel.write_frames(&buffer, size, &progress).is_ok() {
                    sent += frames as u64;
                    counters.frames.store(sent, Ordering::Relaxed);
                }
            }
            Err(error) => *counters.error.lock().unwrap() = Some(error.to_string()),
        }
        if let Some(rest) = every.checked_sub(round.elapsed()) {
            std::thread::sleep(rest);
        }
    }
    counters.stopped_ns.store(now_ns(), Ordering::Relaxed);
}
