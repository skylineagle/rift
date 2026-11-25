mod case;
mod channel;
mod clock;
mod flow;
mod frame;
mod kind;
mod monitor;
mod pty;
mod rift;
mod sides;
mod soak;
mod stats;
mod suites;

use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use clap::{Parser, Subcommand};

use case::{run_case, CaseConfig, Direction, LogMode};
use kind::Kind;

#[derive(Parser)]
struct Cli {
    #[arg(long, default_value = "../target/release/rift")]
    rift: PathBuf,
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
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let rift = std::fs::canonicalize(&cli.rift)?;
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
            let result = run_case(&rift, "case", &config);
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Command::Suites {
            out,
            seconds,
            only,
            serial,
        } => suites::run_all(&rift, &out, Duration::from_secs_f64(seconds), &only, serial)?,
        Command::Soak(arguments) => soak::run(&rift, arguments)?,
    }
    Ok(())
}
