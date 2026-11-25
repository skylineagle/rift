use std::fs::{self, File};
use std::io::Write;
use std::net::{TcpListener, TcpStream, UdpSocket};
use std::path::Path;
use std::time::Duration;

use anyhow::Result;
use serde::Serialize;

use crate::case::{run_case, CaseConfig, CaseResult, Direction, LogMode};
use crate::channel::{prepare_datagram, prepare_stream};
use crate::flow::{Flow, FlowResult, SendPlan};
use crate::kind::{pairs, Kind};

const NETWORK_RATES: &[Option<f64>] = &[
    Some(1.0),
    Some(10.0),
    Some(50.0),
    Some(100.0),
    Some(200.0),
    Some(300.0),
    Some(400.0),
    Some(600.0),
    Some(800.0),
    Some(1200.0),
    None,
];
const SERIAL_RATES: &[Option<f64>] = &[
    Some(0.0115),
    Some(0.1),
    Some(1.0),
    Some(10.0),
    Some(50.0),
    Some(100.0),
    Some(200.0),
    Some(400.0),
    None,
];
const FRAME_SIZES: [usize; 6] = [64, 256, 1024, 1400, 4096, 8192];
const LOG_MODES: [LogMode; 5] = [LogMode::HexQuiet, LogMode::Quiet, LogMode::Json, LogMode::Hex, LogMode::Text];

struct Recorder {
    file: File,
    total: usize,
    done: usize,
}

impl Recorder {
    fn create(directory: &Path, suite: &str, total: usize) -> Result<Self> {
        fs::create_dir_all(directory)?;
        Ok(Self {
            file: File::create(directory.join(format!("{suite}.jsonl")))?,
            total,
            done: 0,
        })
    }

    fn write(&mut self, record: &impl Serialize, label: &str) -> Result<()> {
        writeln!(self.file, "{}", serde_json::to_string(record)?)?;
        self.file.flush()?;
        self.done += 1;
        eprintln!("[{}/{}] {label}", self.done, self.total);
        Ok(())
    }
}

fn describe(result: &CaseResult) -> String {
    let flows: Vec<String> = result
        .flows
        .iter()
        .map(|flow| {
            format!(
                "{} {:.1}MB/s loss {:.3}% p99 {}us",
                flow.name, flow.goodput_mbps, flow.loss_pct, flow.latency.p99_us
            )
        })
        .collect();
    format!(
        "{}<->{} {:?} rate {:?} frame {} log {:?} | {} | rss {:.1}MB cpu {:.0}%{}",
        result.a.label(),
        result.b.label(),
        result.direction,
        result.rate_mbps,
        result.frame_size,
        result.log,
        flows.join(" ; "),
        result.rift.rss_peak_mb,
        result.rift.cpu_avg_pct,
        result.error.as_ref().map(|error| format!(" ERROR {error}")).unwrap_or_default()
    )
}

fn run_and_record(rift: &Path, suite: &str, config: CaseConfig, recorder: &mut Recorder) -> Result<()> {
    let result = run_case(rift, suite, &config);
    recorder.write(&result, &describe(&result))
}

fn matrix_cases(duration: Duration, serial: bool) -> Vec<CaseConfig> {
    let mut cases = Vec::new();
    for (a, b) in pairs() {
        let uses_serial = a == Kind::Uart || b == Kind::Uart;
        if uses_serial && !serial {
            continue;
        }
        let rates = if uses_serial {
            SERIAL_RATES
        } else {
            NETWORK_RATES
        };
        let directions: &[Direction] = if a == b {
            &[Direction::AToB]
        } else {
            &[Direction::AToB, Direction::BToA]
        };
        for &direction in directions {
            for &rate in rates {
                cases.push(CaseConfig {
                    a,
                    b,
                    direction,
                    frame_size: 1024,
                    rate_mbps: rate,
                    duration,
                    log: LogMode::Quiet,
                });
            }
        }
        cases.push(CaseConfig {
            a,
            b,
            direction: Direction::Both,
            frame_size: 1024,
            rate_mbps: None,
            duration,
            log: LogMode::Quiet,
        });
    }
    cases
}

fn frame_cases(duration: Duration) -> Vec<CaseConfig> {
    let pairs = [
        (Kind::TcpServer, Kind::TcpClient),
        (Kind::UdpServer, Kind::UdpClient),
        (Kind::UdpServer, Kind::TcpClient),
        (Kind::TcpServer, Kind::UdpClient),
    ];
    let mut cases = Vec::new();
    for (a, b) in pairs {
        for frame_size in FRAME_SIZES {
            for rate in [Some(100.0), None] {
                cases.push(CaseConfig {
                    a,
                    b,
                    direction: Direction::AToB,
                    frame_size,
                    rate_mbps: rate,
                    duration,
                    log: LogMode::Quiet,
                });
            }
        }
    }
    cases
}

fn log_cases(duration: Duration) -> Vec<CaseConfig> {
    let mut cases = Vec::new();
    for (a, b) in [(Kind::TcpServer, Kind::TcpClient), (Kind::UdpServer, Kind::UdpClient)] {
        for rate in [Some(50.0), None] {
            for log in LOG_MODES {
                cases.push(CaseConfig {
                    a,
                    b,
                    direction: Direction::AToB,
                    frame_size: 1024,
                    rate_mbps: rate,
                    duration,
                    log,
                });
            }
        }
    }
    cases
}

#[derive(Serialize)]
struct BaselineResult {
    suite: &'static str,
    transport: &'static str,
    frame_size: usize,
    rate_mbps: Option<f64>,
    flow: FlowResult,
}

fn baseline(transport: &'static str, frame_size: usize, rate: Option<f64>, duration: Duration) -> Result<BaselineResult> {
    let (from, to) = if transport == "tcp" {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let client = TcpStream::connect(listener.local_addr()?)?;
        let (server, _) = listener.accept()?;
        (prepare_stream(client)?, prepare_stream(server)?)
    } else {
        let receiver = UdpSocket::bind("127.0.0.1:0")?;
        let sender = UdpSocket::bind("127.0.0.1:0")?;
        let target = receiver.local_addr()?;
        let source = sender.local_addr()?;
        (prepare_datagram(sender, target)?, prepare_datagram(receiver, source)?)
    };
    let plan = SendPlan {
        frame_size,
        rate_bytes_per_second: rate.map(|rate| rate * 1e6),
    };
    let mut flow = Flow::start("direct", from, to, plan);
    std::thread::sleep(duration);
    flow.stop_sending();
    flow.drain(Duration::from_millis(400), Duration::from_secs(5));
    Ok(BaselineResult {
        suite: "baseline",
        transport,
        frame_size,
        rate_mbps: rate,
        flow: flow.finish(),
    })
}

fn run_baselines(directory: &Path, duration: Duration) -> Result<()> {
    let rates = [Some(1.0), Some(100.0), Some(400.0), None];
    let mut recorder = Recorder::create(directory, "baseline", 2 * rates.len())?;
    for transport in ["tcp", "udp"] {
        for rate in rates {
            let result = baseline(transport, 1024, rate, duration)?;
            let label = format!(
                "direct {transport} rate {rate:?} {:.1}MB/s loss {:.3}% p99 {}us",
                result.flow.goodput_mbps, result.flow.loss_pct, result.flow.latency.p99_us
            );
            recorder.write(&result, &label)?;
        }
    }
    Ok(())
}

fn run_suite(rift: &Path, directory: &Path, suite: &str, cases: Vec<CaseConfig>) -> Result<()> {
    let mut recorder = Recorder::create(directory, suite, cases.len())?;
    for config in cases {
        run_and_record(rift, suite, config, &mut recorder)?;
    }
    Ok(())
}

pub fn run_all(rift: &Path, directory: &Path, duration: Duration, only: &[String], serial: bool) -> Result<()> {
    let wanted = |suite: &str| only.is_empty() || only.iter().any(|name| name == suite);
    if wanted("baseline") {
        run_baselines(directory, duration)?;
    }
    if wanted("matrix") {
        run_suite(rift, directory, "matrix", matrix_cases(duration, serial))?;
    }
    if wanted("frames") {
        run_suite(rift, directory, "frames", frame_cases(duration))?;
    }
    if wanted("logs") {
        run_suite(rift, directory, "logs", log_cases(duration))?;
    }
    Ok(())
}
