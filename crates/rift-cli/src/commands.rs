use anyhow::{bail, Result};
use rift_core::{list_serial_ports, LoggingConfig, Profile, ProfileStore};

use crate::arguments::{
    ConfigArguments, OutputArguments, PipeArguments, ProfileAction, RunArguments,
};
use crate::config_path::resolve;
use crate::host_setup::Host;
use crate::logging_setup::{log_profile_change, logging_config, optional_logging_config};
use crate::printer::print_events;
use crate::shutdown::wait_for_shutdown;
use crate::stdin_commands::read_commands;

pub async fn run(arguments: RunArguments) -> Result<()> {
    let store = ProfileStore::load(&resolve(&arguments.config)?)?;
    let profiles = select_profiles(&store, &arguments.names, arguments.all)?;
    serve(profiles, logging_config(&store)?, arguments.output).await
}

pub async fn pipe(arguments: PipeArguments) -> Result<()> {
    let profile = Profile {
        name: arguments.name,
        a: arguments.a.parse()?,
        b: arguments.b.parse()?,
        workflows: Vec::new(),
    };
    let config_path = resolve(&arguments.config).ok();
    let logging = optional_logging_config(config_path.as_deref())?;
    serve(vec![profile], logging, arguments.output).await
}

pub fn profile(action: ProfileAction) -> Result<()> {
    match action {
        ProfileAction::List { config } => list_profiles(&config),
        ProfileAction::Add { name, a, b, config } => {
            let path = resolve(&config)?;
            let mut store = ProfileStore::load_or_default(&path)?;
            let logging = logging_config(&store)?;
            store.add(Profile {
                name: name.clone(),
                a: a.parse()?,
                b: b.parse()?,
                workflows: Vec::new(),
            })?;
            store.save(&path)?;
            log_profile_change(logging, "profile.added", "added", &name);
            Ok(())
        }
        ProfileAction::Remove { name, config } => {
            let path = resolve(&config)?;
            let mut store = ProfileStore::load(&path)?;
            let logging = logging_config(&store)?;
            store.remove(&name)?;
            store.save(&path)?;
            log_profile_change(logging, "profile.removed", "removed", &name);
            Ok(())
        }
    }
}

pub fn ports() -> Result<()> {
    for port in list_serial_ports()? {
        println!(
            "{}  {}  {}",
            port.name,
            port.kind,
            port.description.unwrap_or_default()
        );
    }
    Ok(())
}

fn list_profiles(config: &ConfigArguments) -> Result<()> {
    let store = ProfileStore::load_or_default(&resolve(config)?)?;
    for profile in store.list() {
        println!("{}  {}  {}", profile.name, profile.a, profile.b);
    }
    Ok(())
}

fn select_profiles(store: &ProfileStore, names: &[String], all: bool) -> Result<Vec<Profile>> {
    if all {
        return Ok(store.list().to_vec());
    }
    if names.is_empty() {
        bail!("name at least one profile or pass --all");
    }
    names
        .iter()
        .map(|name| match store.get(name) {
            Some(profile) => Ok(profile.clone()),
            None => bail!("profile `{name}` not found"),
        })
        .collect()
}

async fn serve(
    profiles: Vec<Profile>,
    logging: LoggingConfig,
    output: OutputArguments,
) -> Result<()> {
    if profiles.is_empty() {
        bail!("no profiles to run");
    }
    let mut host = Host::new(logging);
    let printer = tokio::spawn(print_events(host.rift.subscribe(), output));
    host.start_profiles(&profiles)?;
    host.accept_remote_commands(profiles);
    tokio::spawn(read_commands(host.rift.clone()));
    wait_for_shutdown().await;
    host.shutdown().await;
    printer.abort();
    Ok(())
}
