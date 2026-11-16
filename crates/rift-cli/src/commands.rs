use std::sync::Arc;

use anyhow::{bail, Result};
use rift_core::{list_serial_ports, Profile, ProfileStore, Rift};

use crate::arguments::{
    ConfigArguments, OutputArguments, PipeArguments, ProfileAction, RunArguments,
};
use crate::config_path::resolve;
use crate::printer::print_events;
use crate::shutdown::wait_for_shutdown;
use crate::stdin_commands::read_commands;

pub async fn run(arguments: RunArguments) -> Result<()> {
    let store = ProfileStore::load(&resolve(&arguments.config)?)?;
    let profiles = select_profiles(&store, &arguments.names, arguments.all)?;
    serve(profiles, arguments.output).await
}

pub async fn pipe(arguments: PipeArguments) -> Result<()> {
    let profile = Profile {
        name: arguments.name,
        a: arguments.a.parse()?,
        b: arguments.b.parse()?,
    };
    serve(vec![profile], arguments.output).await
}

pub fn profile(action: ProfileAction) -> Result<()> {
    match action {
        ProfileAction::List { config } => list_profiles(&config),
        ProfileAction::Add { name, a, b, config } => {
            let path = resolve(&config)?;
            let mut store = ProfileStore::load_or_default(&path)?;
            store.add(Profile {
                name,
                a: a.parse()?,
                b: b.parse()?,
            })?;
            Ok(store.save(&path)?)
        }
        ProfileAction::Remove { name, config } => {
            let path = resolve(&config)?;
            let mut store = ProfileStore::load(&path)?;
            store.remove(&name)?;
            Ok(store.save(&path)?)
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

async fn serve(profiles: Vec<Profile>, output: OutputArguments) -> Result<()> {
    if profiles.is_empty() {
        bail!("no profiles to run");
    }
    let rift = Arc::new(Rift::new());
    let printer = tokio::spawn(print_events(rift.subscribe(), output));
    for profile in profiles {
        rift.start(profile)?;
    }
    tokio::spawn(read_commands(rift.clone()));
    wait_for_shutdown().await;
    rift.stop_all().await;
    printer.abort();
    Ok(())
}
