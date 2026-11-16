use std::sync::Arc;

use anyhow::{anyhow, Result};
use rift_core::Rift;
use tokio::io::{AsyncBufReadExt, BufReader};

use crate::inject_command::{parse, CommandAction};

pub async fn read_commands(rift: Arc<Rift>) {
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        if let Err(error) = execute(&rift, &line).await {
            eprintln!("error: {error}");
        }
    }
}

async fn execute(rift: &Rift, line: &str) -> Result<()> {
    let command = parse(line)?;
    let profile = match command.profile {
        Some(profile) => profile,
        None => only_running_profile(rift)?,
    };
    match command.action {
        CommandAction::Inject(inject) => rift.inject(&profile, inject.target, inject.bytes)?,
        CommandAction::SwitchSide(switch) => {
            rift.set_side_enabled(&profile, switch.side, switch.enabled)
                .await?
        }
    }
    Ok(())
}

fn only_running_profile(rift: &Rift) -> Result<String> {
    let mut running = rift.running();
    match running.len() {
        1 => Ok(running.remove(0)),
        _ => Err(anyhow!(
            "several profiles are running, prefix the command with `<profile>:`"
        )),
    }
}
