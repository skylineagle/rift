use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};

use crate::ci::{Measurement, Report, Sample};
use crate::metric::{Metric, METRICS};
use crate::significance::{holm_adjusted, probability_of_losses_this_large};

const MISSING: &str = "n/a";
const MINIMUM_PAIRS: usize = 4;

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
    Inconclusive,
    Skipped,
    Uncompared,
}

impl Verdict {
    fn label(self) -> &'static str {
        match self {
            Verdict::Passed => "✅ pass",
            Verdict::Regressed => "❌ fail: slower",
            Verdict::Failed => "❌ fail: did not run or deliver",
            Verdict::Inconclusive => "❌ fail: inconclusive, too few valid pairs",
            Verdict::Skipped => "⚠️ skipped: base cannot run this case",
            Verdict::Uncompared => "⚠️ n/a",
        }
    }

    fn blocks(self) -> bool {
        matches!(
            self,
            Verdict::Regressed | Verdict::Failed | Verdict::Inconclusive
        )
    }
}

struct Comparison {
    base: Option<f64>,
    head: Option<f64>,
    pairs: Vec<(f64, f64)>,
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
    let family = family(&tests, arguments.holm);
    test_pairs(&mut tests, required_pairs(arguments.alpha, family));
    if arguments.holm {
        apply_holm(&mut tests);
    }
    for test in &mut tests {
        test.comparison.verdict = gate.judge(test.metric, &test.comparison);
    }
    announce_skipped(&tests);
    print_table(&tests, arguments.holm);
    let failing = case_names(&tests, Verdict::blocks);
    match arguments.failing_cases {
        Some(path) => write_failing_cases(&path, &failing),
        None if failing.is_empty() => Ok(()),
        None => bail!(
            "{} cases failed, were inconclusive or got significantly worse",
            failing.len()
        ),
    }
}

fn family(tests: &[Test], holm: bool) -> usize {
    if !holm {
        return 1;
    }
    tests
        .iter()
        .filter(|test| test.comparison.verdict == Verdict::Passed)
        .count()
}

fn required_pairs(alpha: f64, family: usize) -> usize {
    let mut pairs = MINIMUM_PAIRS;
    while family as f64 / 2f64.powi(pairs as i32) >= alpha {
        pairs += 1;
    }
    pairs
}

fn test_pairs(tests: &mut [Test], required: usize) {
    for test in tests
        .iter_mut()
        .filter(|test| test.comparison.verdict == Verdict::Passed)
    {
        if test.comparison.pairs.len() < required {
            test.comparison.verdict = Verdict::Inconclusive;
        } else {
            let losses = test.metric.losses(&test.comparison.pairs);
            test.comparison.probability = Some(probability_of_losses_this_large(&losses));
        }
    }
}

fn announce_skipped(tests: &[Test]) {
    let mut names = case_names(tests, |verdict| verdict == Verdict::Skipped);
    names.dedup();
    for name in names {
        eprintln!("::notice title=Bench case skipped::The base revision cannot run {name}.");
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

fn case_names<'a>(tests: &[Test<'a>], wanted: impl Fn(Verdict) -> bool) -> Vec<&'a str> {
    let mut names: Vec<&str> = tests
        .iter()
        .filter(|test| wanted(test.comparison.verdict))
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
                    comparison: compare(metric, previous, case),
                });
            }
        }
        tests
    }

    fn judge(&self, metric: &Metric, comparison: &Comparison) -> Verdict {
        let Some(probability) = comparison.probability else {
            return comparison.verdict;
        };
        let (base_mean, head_mean) = means(&comparison.pairs);
        if probability < self.alpha && metric.loss(base_mean, head_mean) > self.threshold {
            Verdict::Regressed
        } else {
            Verdict::Passed
        }
    }
}

fn compare(metric: &Metric, base: Option<&Measurement>, head: &Measurement) -> Comparison {
    let base_samples = base.map_or(&[][..], |case| &case.samples);
    let pairs = pairs(metric, base_samples, &head.samples);
    let verdict = if head.error.is_some() {
        Verdict::Failed
    } else if base_samples.is_empty() {
        Verdict::Skipped
    } else if is_unmeasured(metric, base_samples) && is_unmeasured(metric, &head.samples) {
        Verdict::Uncompared
    } else {
        Verdict::Passed
    };
    Comparison {
        base: median(&values(metric, base_samples)),
        head: median(&values(metric, &head.samples)),
        pairs,
        probability: None,
        verdict,
    }
}

fn pairs(metric: &Metric, base: &[Sample], head: &[Sample]) -> Vec<(f64, f64)> {
    head.iter()
        .filter_map(|sample| {
            let partner = base.iter().find(|other| other.round == sample.round)?;
            (metric.read)(partner).zip((metric.read)(sample))
        })
        .collect()
}

fn is_unmeasured(metric: &Metric, samples: &[Sample]) -> bool {
    values(metric, samples).is_empty()
}

fn means(pairs: &[(f64, f64)]) -> (f64, f64) {
    let count = pairs.len() as f64;
    let base: f64 = pairs.iter().map(|pair| pair.0).sum();
    let head: f64 = pairs.iter().map(|pair| pair.1).sum();
    (base / count, head / count)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn measurement(throughputs: &[(u32, f64)]) -> Measurement {
        Measurement {
            name: "case".to_string(),
            samples: throughputs
                .iter()
                .map(|&(round, throughput_mbps)| Sample {
                    round,
                    throughput_mbps,
                    cpu_pct_per_mbps: None,
                    rss_peak_mb: None,
                })
                .collect(),
            error: None,
        }
    }

    #[test]
    fn pairs_samples_by_round() {
        let base = measurement(&[(1, 10.0), (3, 30.0)]);
        let head = measurement(&[(1, 9.0), (2, 19.0), (3, 29.0)]);
        let comparison = compare(&METRICS[0], Some(&base), &head);
        assert_eq!(comparison.pairs, [(10.0, 9.0), (30.0, 29.0)]);
    }

    #[test]
    fn too_few_pairs_are_inconclusive_and_block() {
        let base = measurement(&[(1, 10.0)]);
        let head = measurement(&[(1, 9.0), (2, 9.0)]);
        let mut tests = [Test {
            case: "case",
            metric: &METRICS[0],
            comparison: compare(&METRICS[0], Some(&base), &head),
        }];
        test_pairs(&mut tests, required_pairs(0.05, 1));
        assert_eq!(tests[0].comparison.verdict, Verdict::Inconclusive);
        assert!(tests[0].comparison.verdict.blocks());
    }

    #[test]
    fn a_case_base_never_ran_is_skipped() {
        let head = measurement(&[(1, 9.0)]);
        let comparison = compare(&METRICS[0], Some(&measurement(&[])), &head);
        assert_eq!(comparison.verdict, Verdict::Skipped);
    }

    #[test]
    fn required_pairs_keep_a_total_loss_detectable() {
        assert_eq!(required_pairs(0.05, 1), 5);
        assert_eq!(required_pairs(0.05, 8), 8);
    }
}
