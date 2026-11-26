mod arguments;
mod commands;
mod config_path;
mod duration;
mod host_setup;
mod inject_cli;
mod inject_command;
mod install_source;
mod logging_setup;
mod printer;
mod release;
mod render;
mod shutdown;
mod stdin_commands;
mod update_cache;
mod update_command;
mod update_notice;
mod workflow_command;

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
        Command::Inject(arguments) => inject_cli::inject(arguments),
        Command::Workflow { action } => workflow_command::workflow(action),
        Command::Profile { action } => commands::profile(action),
        Command::Ports => commands::ports(),
    }
}
