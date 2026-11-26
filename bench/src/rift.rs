use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Default, Serialize)]
pub struct SideLog {
    pub listening: bool,
    pub connected: bool,
    pub dropped_chunks: u64,
    pub errors: Vec<String>,
}

pub type RiftLog = Arc<Mutex<HashMap<String, SideLog>>>;

pub fn side_key(profile: &str, side: &str) -> String {
    format!("{profile}:{side}")
}

#[derive(Debug, Clone)]
pub struct RiftCommand {
    program: PathBuf,
    prefix: Vec<String>,
    pub measurable: bool,
}

impl RiftCommand {
    pub fn binary(path: &Path) -> Result<Self> {
        let program = std::fs::canonicalize(path)
            .with_context(|| format!("rift binary {}", path.display()))?;
        Ok(Self {
            program,
            prefix: Vec::new(),
            measurable: true,
        })
    }

    pub fn wrapped(line: &str) -> Result<Self> {
        let mut words = line.split_whitespace().map(str::to_string);
        let program = words.next().context("rift command is empty")?;
        Ok(Self {
            program: program.into(),
            prefix: words.collect(),
            measurable: false,
        })
    }

    fn command(&self) -> Command {
        let mut command = Command::new(&self.program);
        command.args(&self.prefix);
        command
    }
}

pub struct RiftProcess {
    child: Child,
    pub pid: i32,
    pub log: RiftLog,
}

#[derive(Clone, Copy)]
pub enum Output {
    Parsed,
    Discarded(&'static str),
    Silent,
}

impl RiftProcess {
    pub fn spawn(rift: &RiftCommand, arguments: &[String], output: Output) -> Result<Self> {
        let mut command = rift.command();
        command
            .args(arguments)
            .env("RIFT_NO_UPDATE_CHECK", "1")
            .stdin(Stdio::null())
            .stderr(Stdio::null());
        match output {
            Output::Parsed => command
                .args(["--log", "json", "--quiet"])
                .stdout(Stdio::piped()),
            Output::Discarded(format) => command.args(["--log", format]).stdout(Stdio::null()),
            Output::Silent => command.arg("--quiet").stdout(Stdio::null()),
        };
        let mut child = command.spawn()?;
        let log = RiftLog::default();
        if let Some(stdout) = child.stdout.take() {
            let log = log.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    absorb(&log, &line);
                }
            });
        }
        Ok(Self {
            pid: child.id() as i32,
            child,
            log,
        })
    }

    pub fn wait_for(
        &self,
        timeout: Duration,
        ready: impl Fn(&HashMap<String, SideLog>) -> bool,
    ) -> bool {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if ready(&self.log.lock().unwrap()) {
                return true;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        false
    }

    pub fn snapshot(&self) -> HashMap<String, SideLog> {
        self.log.lock().unwrap().clone()
    }

    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    pub fn stop(mut self) {
        unsafe {
            libc::kill(self.pid, libc::SIGTERM);
        }
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if !matches!(self.child.try_wait(), Ok(None)) {
                return;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn absorb(log: &RiftLog, line: &str) {
    let Ok(event) = serde_json::from_str::<Value>(line) else {
        return;
    };
    let profile = event["profile"].as_str().unwrap_or_default();
    let side = event["side"].as_str().unwrap_or_default();
    let mut log = log.lock().unwrap();
    let entry = log.entry(side_key(profile, side)).or_default();
    match event["type"].as_str() {
        Some("status") => match event["state"]["state"].as_str() {
            Some("listening") => entry.listening = true,
            Some("connected") => entry.connected = true,
            Some("error") => {
                let message = event["state"]["message"].as_str().unwrap_or_default();
                if entry.errors.len() < 20 {
                    entry.errors.push(message.to_string());
                }
            }
            _ => {}
        },
        Some("dropped") => entry.dropped_chunks += event["chunks"].as_u64().unwrap_or(0),
        _ => {}
    }
}
