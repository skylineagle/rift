mod arguments;
mod commands;
mod config_path;
mod inject_command;
mod install_source;
mod printer;
mod release;
mod render;
mod shutdown;
mod stdin_commands;
mod update_cache;
mod update_command;
mod update_notice;

use anyhow::Result;
use clap::Parser;

use arguments::{Cli, Command};

#[tokio::main]
async fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Run(arguments) => {
            update_notice::announce_updates();
            commands::run(arguments).await
        }
        Command::Pipe(arguments) => {
            update_notice::announce_updates();
            commands::pipe(arguments).await
        }
        Command::Update { check } => update_command::update(check).await,
        Command::Profile { action } => commands::profile(action),
        Command::Ports => commands::ports(),
    }
}
