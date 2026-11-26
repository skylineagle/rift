use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};

use crate::ci::{Measurement, Report, Sample};
use crate::metric::{Metric, METRICS};
use crate::significance::{holm_adjusted, probability_of_ranking_this_low};

const MISSING: &str = "n/a";

#[derive(clap::Args)]
pub struct CompareArguments {
    #[arg(long)]
    base: PathBuf,
    #[arg(long)]
    head: PathBuf,
    #[arg(long, default_value_t = 0.0)]
    threshold: f64,
    #[arg(long, default_value_t = 0.05)]
    alpha: f64,
    #[arg(long)]
    holm: bool,
    #[arg(long)]
    failing_cases: Option<PathBuf>,
}

struct Gate {
    threshold: f64,
    alpha: f64,
}

struct Test<'a> {
    case: &'a str,
    metric: &'a Metric,
    comparison: Comparison,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Verdict {
    Passed,
    Regressed,
    Failed,
    Uncompared,
}

impl Verdict {
    fn label(self) -> &'static str {
        match self {
            Verdict::Passed => "✅ pass",
            Verdict::Regressed => "❌ fail: slower",
            Verdict::Failed => "❌ fail: did not run",
            Verdict::Uncompared => "⚠️ n/a",
        }
    }

    fn blocks(self) -> bool {
        matches!(self, Verdict::Regressed | Verdict::Failed)
    }
}

struct Comparison {
    base: Option<f64>,
    head: Option<f64>,
    probability: Option<f64>,
    verdict: Verdict,
}

pub fn run(arguments: CompareArguments) -> Result<()> {
    let base = load(&arguments.base)?;
    let head = load(&arguments.head)?;
    let gate = Gate {
        threshold: arguments.threshold,
        alpha: arguments.alpha,
    };
    let mut tests = gate.compare_all(&base, &head);
    if arguments.holm {
        apply_holm(&mut tests);
    }
    for test in &mut tests {
        test.comparison.verdict = gate.verdict(test.metric, &test.comparison);
    }
    print_table(&tests, arguments.holm);
    let failing = failing_case_names(&tests);
    match arguments.failing_cases {
        Some(path) => write_failing_cases(&path, &failing),
        None if failing.is_empty() => Ok(()),
        None => bail!("{} cases failed or got significantly worse", failing.len()),
    }
}

fn apply_holm(tests: &mut [Test]) {
    let tested: Vec<&mut Comparison> = tests
        .iter_mut()
        .map(|test| &mut test.comparison)
        .filter(|comparison| comparison.probability.is_some())
        .collect();
    let probabilities: Vec<f64> = tested
        .iter()
        .filter_map(|comparison| comparison.probability)
        .collect();
    for (comparison, adjusted) in tested.into_iter().zip(holm_adjusted(&probabilities)) {
        comparison.probability = Some(adjusted);
    }
}

fn print_table(tests: &[Test], holm: bool) {
    let probability_header = if holm { "p (Holm)" } else { "p" };
    println!("| case | metric | base median | head median | Δ | {probability_header} | result |");
    println!("|---|---|--:|--:|--:|--:|---|");
    for test in tests {
        println!("{}", row(test.case, test.metric, &test.comparison));
    }
}

fn failing_case_names<'a>(tests: &[Test<'a>]) -> Vec<&'a str> {
    let mut names: Vec<&str> = tests
        .iter()
        .filter(|test| test.comparison.verdict.blocks())
        .map(|test| test.case)
        .collect();
    names.dedup();
    names
}

fn write_failing_cases(path: &Path, names: &[&str]) -> Result<()> {
    let content: String = names.iter().map(|name| format!("{name}\n")).collect();
    fs::write(path, content).with_context(|| format!("write {}", path.display()))
}

fn load(path: &Path) -> Result<Report> {
    let content = fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    serde_json::from_str(&content).with_context(|| format!("parse {}", path.display()))
}

impl Gate {
    fn compare_all<'a>(&self, base: &'a Report, head: &'a Report) -> Vec<Test<'a>> {
        let mut tests = Vec::new();
        for case in &head.cases {
            let previous = base
                .cases
                .iter()
                .find(|candidate| candidate.name == case.name);
            for metric in &METRICS {
                tests.push(Test {
                    case: &case.name,
                    metric,
                    comparison: self.compare(metric, previous, case),
                });
            }
        }
        tests
    }

    fn verdict(&self, metric: &Metric, comparison: &Comparison) -> Verdict {
        if comparison.verdict == Verdict::Failed {
            return Verdict::Failed;
        }
        self.judge(
            metric,
            (comparison.base, comparison.head),
            comparison.probability,
        )
    }

    fn compare(
        &self,
        metric: &Metric,
        base: Option<&Measurement>,
        head: &Measurement,
    ) -> Comparison {
        let base_values = base
            .filter(|case| case.error.is_none())
            .map_or_else(Vec::new, |case| values(metric, &case.samples));
        let head_values = values(metric, &head.samples);
        let medians = (median(&base_values), median(&head_values));
        let probability = medians
            .0
            .zip(medians.1)
            .map(|_| metric.probability_of_worse(&base_values, &head_values));
        let verdict = if head.error.is_some() {
            Verdict::Failed
        } else {
            self.judge(metric, medians, probability)
        };
        Comparison {
            base: medians.0,
            head: medians.1,
            probability,
            verdict,
        }
    }

    fn judge(
        &self,
        metric: &Metric,
        medians: (Option<f64>, Option<f64>),
        probability: Option<f64>,
    ) -> Verdict {
        let (Some(base), Some(head), Some(probability)) = (medians.0, medians.1, probability)
        else {
            return Verdict::Uncompared;
        };
        if probability < self.alpha && metric.loss(base, head) > self.threshold {
            Verdict::Regressed
        } else {
            Verdict::Passed
        }
    }
}

impl Metric {
    fn probability_of_worse(&self, base: &[f64], head: &[f64]) -> f64 {
        if self.higher_is_better {
            probability_of_ranking_this_low(head, base)
        } else {
            probability_of_ranking_this_low(base, head)
        }
    }
}

fn values(metric: &Metric, samples: &[Sample]) -> Vec<f64> {
    samples.iter().filter_map(metric.read).collect()
}

fn median(values: &[f64]) -> Option<f64> {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let upper = *sorted.get(sorted.len() / 2)?;
    let lower = sorted[(sorted.len() - 1) / 2];
    Some((lower + upper) / 2.0)
}

fn row(case: &str, metric: &Metric, comparison: &Comparison) -> String {
    format!(
        "| {case} | {} | {} | {} | {} | {} | {} |",
        metric.name,
        number(comparison.base, metric.decimals),
        number(comparison.head, metric.decimals),
        delta(comparison.base, comparison.head),
        number(comparison.probability, 3),
        comparison.verdict.label()
    )
}

fn number(value: Option<f64>, decimals: usize) -> String {
    value.map_or_else(
        || MISSING.to_string(),
        |value| format!("{value:.decimals$}"),
    )
}

fn delta(base: Option<f64>, head: Option<f64>) -> String {
    match (base, head) {
        (Some(base), Some(head)) if base > 0.0 => format!("{:+.2}%", (head / base - 1.0) * 100.0),
        _ => MISSING.to_string(),
    }
}
