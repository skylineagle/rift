use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

use crate::case::{run_case, CaseResult};
use crate::delivery;
use crate::rift::RiftCommand;
use crate::scenarios::{Scenario, SCENARIOS};

const ATTEMPTS: u32 = 3;

#[derive(clap::Args)]
pub struct CiArguments {
    #[arg(long)]
    out: PathBuf,
    #[arg(long, default_value_t = 2.0)]
    seconds: f64,
    #[arg(long, default_value_t = 5, value_parser = clap::value_parser!(u32).range(1..=20))]
    rounds: u32,
    #[arg(long, conflicts_with = "base_rift_command")]
    base_rift: Option<PathBuf>,
    #[arg(long)]
    base_rift_command: Option<String>,
    #[arg(long)]
    cases: Option<PathBuf>,
}

impl CiArguments {
    fn base(&self) -> Result<Option<RiftCommand>> {
        match (&self.base_rift, &self.base_rift_command) {
            (Some(path), _) => RiftCommand::binary(path).map(Some),
            (None, Some(line)) => RiftCommand::wrapped(line).map(Some),
            (None, None) => Ok(None),
        }
    }

    fn scenarios(&self) -> Result<Vec<&'static Scenario>> {
        let Some(path) = &self.cases else {
            return Ok(SCENARIOS.iter().collect());
        };
        let names = fs::read_to_string(path)?;
        let selected: Vec<&Scenario> = SCENARIOS
            .iter()
            .filter(|scenario| names.lines().any(|name| name == scenario.name))
            .collect();
        if selected.is_empty() {
            bail!("{} names no known ci case", path.display());
        }
        Ok(selected)
    }
}

#[derive(Default, Serialize, Deserialize)]
pub struct Report {
    pub cases: Vec<Measurement>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Measurement {
    pub name: String,
    pub samples: Vec<Sample>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Sample {
    pub round: u32,
    pub throughput_mbps: f64,
    pub cpu_pct_per_mbps: Option<f64>,
    pub rss_peak_mb: Option<f64>,
}

impl Measurement {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            samples: Vec::new(),
            error: None,
        }
    }

    fn record(&mut self, outcome: Result<Sample, String>) {
        match outcome {
            Ok(sample) => self.samples.push(sample),
            Err(error) => self.error = Some(error),
        }
    }
}

struct Contender {
    label: &'static str,
    rift: RiftCommand,
    report: Report,
}

impl Contender {
    fn new(label: &'static str, rift: RiftCommand) -> Self {
        Self {
            label,
            rift,
            report: Report::default(),
        }
    }
}

pub fn run(head: &RiftCommand, arguments: CiArguments) -> Result<()> {
    let mut contenders: Vec<Contender> = arguments
        .base()?
        .map(|base| Contender::new("base", base))
        .into_iter()
        .collect();
    contenders.push(Contender::new("head", head.clone()));
    let duration = Duration::from_secs_f64(arguments.seconds);
    for scenario in arguments.scenarios()? {
        measure_interleaved(&mut contenders, scenario, duration, arguments.rounds);
    }
    fs::create_dir_all(&arguments.out)?;
    for contender in &contenders {
        write(&contender.report, &arguments.out, contender.label)?;
    }
    contenders
        .last()
        .map_or(Ok(()), |head| fail_on_errors(&head.report))
}

fn measure_interleaved(
    contenders: &mut [Contender],
    scenario: &Scenario,
    duration: Duration,
    rounds: u32,
) {
    for contender in contenders.iter_mut() {
        contender.report.cases.push(Measurement::new(scenario.name));
    }
    for round in 1..=rounds {
        for position in order(contenders.len(), round) {
            let contender = &mut contenders[position];
            let label = format!("{} [{round}/{rounds}] {}", scenario.name, contender.label);
            let outcome = measure_with_retries(&contender.rift, scenario, duration, round, &label);
            if let Some(measurement) = contender.report.cases.last_mut() {
                measurement.record(outcome);
            }
        }
    }
}

fn order(count: usize, round: u32) -> Vec<usize> {
    let mut positions: Vec<usize> = (0..count).collect();
    if round.is_multiple_of(2) {
        positions.reverse();
    }
    positions
}

fn measure_with_retries(
    rift: &RiftCommand,
    scenario: &Scenario,
    duration: Duration,
    round: u32,
    label: &str,
) -> Result<Sample, String> {
    retry(ATTEMPTS, || {
        let result = run_case(rift, "ci", &scenario.config(duration));
        let outcome = sample(&result, round);
        eprintln!("{label} {}", describe(&outcome));
        outcome
    })
}

fn retry<T, E>(attempts: u32, mut attempt: impl FnMut() -> Result<T, E>) -> Result<T, E> {
    let mut outcome = attempt();
    for _ in 1..attempts {
        if outcome.is_ok() {
            break;
        }
        outcome = attempt();
    }
    outcome
}

fn sample(result: &CaseResult, round: u32) -> Result<Sample, String> {
    if let Some(error) = failure(result) {
        return Err(error);
    }
    let throughput_mbps = delivery::check(result)?;
    Ok(Sample {
        round,
        throughput_mbps,
        cpu_pct_per_mbps: result
            .rift
            .as_ref()
            .map(|usage| usage.cpu_avg_pct / throughput_mbps),
        rss_peak_mb: result.rift.as_ref().map(|usage| usage.rss_peak_mb),
    })
}

fn failure(result: &CaseResult) -> Option<String> {
    if let Some(error) = &result.error {
        return Some(error.clone());
    }
    if !result.ready {
        return Some("rift never reported both sides connected".to_string());
    }
    result.flows.iter().find_map(|flow| match &flow.error {
        Some(error) => Some(format!("{}: {error}", flow.name)),
        None if flow.received_frames == 0 => Some(format!("{}: nothing arrived", flow.name)),
        None => None,
    })
}

fn describe(outcome: &Result<Sample, String>) -> String {
    match outcome {
        Ok(sample) => format!("{:.1} MB/s", sample.throughput_mbps),
        Err(error) => format!("failed: {error}"),
    }
}

fn write(report: &Report, directory: &Path, label: &str) -> Result<()> {
    let path = directory.join(format!("{label}.json"));
    fs::write(path, serde_json::to_string_pretty(report)?)?;
    Ok(())
}

fn fail_on_errors(report: &Report) -> Result<()> {
    let failed = report
        .cases
        .iter()
        .filter(|case| case.error.is_some())
        .count();
    if failed > 0 {
        bail!("{failed} ci cases failed on head");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_alternate_which_side_runs_first() {
        assert_eq!(order(2, 1), [0, 1]);
        assert_eq!(order(2, 2), [1, 0]);
    }

    #[test]
    fn a_failed_round_is_retried_twice() {
        let mut calls = 0;
        let outcome: Result<(), ()> = retry(ATTEMPTS, || {
            calls += 1;
            Err(())
        });
        assert!(outcome.is_err());
        assert_eq!(calls, 3);
    }
}
