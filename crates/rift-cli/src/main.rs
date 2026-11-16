mod arguments;
mod commands;
mod config_path;
mod inject_command;
mod printer;
mod render;
mod shutdown;
mod stdin_commands;

use anyhow::Result;
use clap::Parser;

use arguments::{Cli, Command};

#[tokio::main]
async fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Run(arguments) => commands::run(arguments).await,
        Command::Pipe(arguments) => commands::pipe(arguments).await,
        Command::Profile { action } => commands::profile(action),
        Command::Ports => commands::ports(),
    }
}
