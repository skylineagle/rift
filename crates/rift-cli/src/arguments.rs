use std::path::PathBuf;

use clap::{Args, Parser, Subcommand, ValueEnum};

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
    Profile {
        #[command(subcommand)]
        action: ProfileAction,
    },
    Ports,
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
    pub a: String,
    pub b: String,
    #[arg(long, default_value = "adhoc")]
    pub name: String,
    #[command(flatten)]
    pub output: OutputArguments,
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
