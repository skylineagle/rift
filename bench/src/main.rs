mod case;
mod channel;
mod ci;
mod clock;
mod compare;
mod delivery;
mod flow;
mod frame;
mod kind;
mod metric;
mod monitor;
mod pty;
mod rift;
mod scenarios;
mod sides;
mod significance;
mod soak;
mod stats;
mod suites;

use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::Result;
use clap::{Parser, Subcommand};

use case::{run_case, CaseConfig, Direction, LogMode};
use kind::Kind;
use rift::RiftCommand;

#[derive(Parser)]
struct Cli {
    #[arg(long, default_value = "../target/release/rift")]
    rift: PathBuf,
    #[arg(long, conflicts_with = "rift")]
    rift_command: Option<String>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Case {
        #[arg(long)]
        a: Kind,
        #[arg(long)]
        b: Kind,
        #[arg(long, default_value = "a-to-b")]
        direction: Direction,
        #[arg(long, default_value_t = 1024)]
        frame: usize,
        #[arg(long)]
        rate: Option<f64>,
        #[arg(long, default_value_t = 5.0)]
        seconds: f64,
        #[arg(long, default_value = "quiet")]
        log: LogMode,
    },
    Suites {
        #[arg(long, default_value = "results")]
        out: PathBuf,
        #[arg(long, default_value_t = 4.0)]
        seconds: f64,
        #[arg(long, value_delimiter = ',')]
        only: Vec<String>,
        #[arg(long)]
        serial: bool,
    },
    Soak(soak::SoakArguments),
    Ci(ci::CiArguments),
    Compare(compare::CompareArguments),
}

fn resolve_rift(path: &Path, command: Option<&str>) -> Result<RiftCommand> {
    match command {
        Some(line) => RiftCommand::wrapped(line),
        None => RiftCommand::binary(path),
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let rift = resolve_rift(&cli.rift, cli.rift_command.as_deref());
    match cli.command {
        Command::Case {
            a,
            b,
            direction,
            frame,
            rate,
            seconds,
            log,
        } => {
            let config = CaseConfig {
                a,
                b,
                direction,
                frame_size: frame,
                rate_mbps: rate,
                duration: Duration::from_secs_f64(seconds),
                log,
            };
            let result = run_case(&rift?, "case", &config);
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Command::Suites {
            out,
            seconds,
            only,
            serial,
        } => suites::run_all(
            &rift?,
            &out,
            Duration::from_secs_f64(seconds),
            &only,
            serial,
        )?,
        Command::Soak(arguments) => soak::run(&rift?, arguments)?,
        Command::Ci(arguments) => ci::run(&rift?, arguments)?,
        Command::Compare(arguments) => compare::run(arguments)?,
    }
    Ok(())
}
