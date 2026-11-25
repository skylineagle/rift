use std::path::Path;
use std::time::Duration;

use anyhow::Result;
use clap::ValueEnum;
use serde::Serialize;

use crate::clock::now_ns;
use crate::flow::{Flow, FlowResult, SendPlan};
use crate::kind::Kind;
use crate::monitor::{summarize, Monitor, Usage};
use crate::rift::{side_key, Output, RiftProcess};
use crate::sides::{prepare, Connected};

const PROFILE: &str = "bench";
const SIDES: [&str; 2] = ["A", "B"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum Direction {
    AToB,
    BToA,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ValueEnum)]
#[serde(rename_all = "kebab-case")]
pub enum LogMode {
    Quiet,
    HexQuiet,
    Json,
    Hex,
    Text,
}

impl LogMode {
    fn output(self) -> Output {
        match self {
            LogMode::Quiet => Output::Parsed,
            LogMode::HexQuiet => Output::Silent,
            LogMode::Json => Output::Discarded("json"),
            LogMode::Hex => Output::Discarded("hex"),
            LogMode::Text => Output::Discarded("text"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CaseConfig {
    pub a: Kind,
    pub b: Kind,
    pub direction: Direction,
    pub frame_size: usize,
    pub rate_mbps: Option<f64>,
    pub duration: Duration,
    pub log: LogMode,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaseResult {
    pub suite: String,
    pub a: Kind,
    pub b: Kind,
    pub direction: Direction,
    pub frame_size: usize,
    pub rate_mbps: Option<f64>,
    pub duration_s: f64,
    pub log: LogMode,
    pub ready: bool,
    pub flows: Vec<FlowResult>,
    pub rift: Usage,
    pub rift_dropped_chunks: u64,
    pub rift_errors: Vec<String>,
    pub error: Option<String>,
}

pub fn run_case(binary: &Path, suite: &str, config: &CaseConfig) -> CaseResult {
    let mut result = CaseResult {
        suite: suite.to_string(),
        a: config.a,
        b: config.b,
        direction: config.direction,
        frame_size: config.frame_size,
        rate_mbps: config.rate_mbps,
        duration_s: config.duration.as_secs_f64(),
        log: config.log,
        ready: false,
        flows: Vec::new(),
        rift: Usage::default(),
        rift_dropped_chunks: 0,
        rift_errors: Vec::new(),
        error: None,
    };
    if let Err(error) = execute(binary, config, &mut result) {
        result.error = Some(format!("{error:#}"));
    }
    result
}

fn is_listener(kind: Kind) -> bool {
    matches!(kind, Kind::TcpServer | Kind::UdpServer)
}

fn execute(binary: &Path, config: &CaseConfig, result: &mut CaseResult) -> Result<()> {
    let a = prepare(config.a)?;
    let b = prepare(config.b)?;
    let arguments = vec![
        "pipe".to_string(),
        a.uri.clone(),
        b.uri.clone(),
        "--name".to_string(),
        PROFILE.to_string(),
    ];
    let output = config.log.output();
    let rift = RiftProcess::spawn(binary, &arguments, output)?;
    let monitor = Monitor::start(rift.pid, Duration::from_millis(100));
    let kinds = [config.a, config.b];
    let parsed = matches!(output, Output::Parsed);
    if parsed {
        rift.wait_for(Duration::from_secs(5), |log| {
            SIDES.iter().zip(kinds).all(|(side, kind)| {
                !is_listener(kind)
                    || log
                        .get(&side_key(PROFILE, side))
                        .is_some_and(|entry| entry.listening)
            })
        });
    } else {
        std::thread::sleep(Duration::from_millis(700));
    }
    let outcome = connect_and_run(&rift, a.connect(Duration::from_secs(5)), b.connect(Duration::from_secs(5)), config, parsed);
    let log = rift.snapshot();
    rift.stop();
    let samples = monitor.finish();
    let (ready, flows, window) = outcome?;
    result.ready = ready;
    result.flows = flows;
    result.rift = summarize(&samples, window.0, window.1);
    for entry in log.values() {
        result.rift_dropped_chunks += entry.dropped_chunks;
        result.rift_errors.extend(entry.errors.iter().cloned());
    }
    Ok(())
}

type Outcome = (bool, Vec<FlowResult>, (u64, u64));

fn connect_and_run(
    rift: &RiftProcess,
    a: Result<Connected>,
    b: Result<Connected>,
    config: &CaseConfig,
    parsed: bool,
) -> Result<Outcome> {
    let a = a?;
    let b = b?;
    let ready = if parsed {
        rift.wait_for(Duration::from_secs(5), |log| {
            SIDES.iter().all(|side| {
                log.get(&side_key(PROFILE, side))
                    .is_some_and(|entry| entry.connected)
            })
        })
    } else {
        std::thread::sleep(Duration::from_millis(500));
        true
    };
    std::thread::sleep(Duration::from_millis(200));
    let plan = SendPlan {
        frame_size: config.frame_size,
        rate_bytes_per_second: config.rate_mbps.map(|rate| rate * 1e6),
    };
    let mut flows = Vec::new();
    if config.direction != Direction::BToA {
        flows.push(Flow::start("a->b", a.channel.try_clone()?, b.channel.try_clone()?, plan));
    }
    if config.direction != Direction::AToB {
        flows.push(Flow::start("b->a", b.channel.try_clone()?, a.channel.try_clone()?, plan));
    }
    let started = now_ns();
    std::thread::sleep(config.duration);
    for flow in &mut flows {
        flow.stop_sending();
    }
    for flow in &mut flows {
        flow.drain(Duration::from_millis(400), Duration::from_secs(5));
    }
    let finished = now_ns();
    let results = flows.into_iter().map(Flow::finish).collect();
    drop((a, b));
    Ok((ready, results, (started, finished)))
}
