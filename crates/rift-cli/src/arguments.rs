use std::path::PathBuf;
use std::time::Duration;

use clap::{Args, Parser, Subcommand, ValueEnum};
use rift_core::{PayloadFormat, Target};

use crate::duration::parse_duration;

#[derive(Parser)]
#[command(
    name = "rift",
    version,
    about = "Bridge two connections and forward bytes both ways"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    Run(RunArguments),
    Pipe(PipeArguments),
    Inject(InjectArguments),
    Workflow {
        #[command(subcommand)]
        action: WorkflowAction,
    },
    Profile {
        #[command(subcommand)]
        action: ProfileAction,
    },
    Ports,
    Update {
        #[arg(long)]
        check: bool,
    },
}

#[derive(Args)]
pub struct ConfigArguments {
    #[arg(short, long, env = "RIFT_CONFIG")]
    pub config: Option<PathBuf>,
}

#[derive(Clone, Copy, ValueEnum)]
pub enum LogFormat {
    Text,
    Hex,
    Json,
}

#[derive(Args)]
pub struct OutputArguments {
    #[arg(long, value_enum, default_value = "hex")]
    pub log: LogFormat,
    #[arg(long)]
    pub quiet: bool,
}

#[derive(Args)]
pub struct RunArguments {
    #[command(flatten)]
    pub config: ConfigArguments,
    pub names: Vec<String>,
    #[arg(long)]
    pub all: bool,
    #[command(flatten)]
    pub output: OutputArguments,
}

#[derive(Args)]
pub struct PipeArguments {
    #[command(flatten)]
    pub config: ConfigArguments,
    pub a: String,
    pub b: String,
    #[arg(long, default_value = "adhoc")]
    pub name: String,
    #[command(flatten)]
    pub output: OutputArguments,
}

#[derive(Args)]
pub struct InjectArguments {
    pub profile: String,
    #[arg(value_name = "a|b|both")]
    pub target: Target,
    #[arg(value_name = "text|hex|bin|file")]
    pub format: PayloadFormat,
    #[arg(required = true)]
    pub payload: Vec<String>,
    #[arg(long, value_name = "DURATION", value_parser = parse_duration)]
    pub every: Option<Duration>,
    #[arg(long, requires = "every", value_parser = clap::value_parser!(u32).range(1..))]
    pub count: Option<u32>,
}

#[derive(Subcommand)]
pub enum WorkflowAction {
    List {
        #[command(flatten)]
        config: ConfigArguments,
    },
    Start {
        profile: String,
        name: String,
    },
    Stop {
        profile: String,
        name: String,
    },
    Status,
}

#[derive(Subcommand)]
pub enum ProfileAction {
    List {
        #[command(flatten)]
        config: ConfigArguments,
    },
    Add {
        name: String,
        a: String,
        b: String,
        #[command(flatten)]
        config: ConfigArguments,
    },
    Remove {
        name: String,
        #[command(flatten)]
        config: ConfigArguments,
    },
}
