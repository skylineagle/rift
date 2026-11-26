use std::io;

use rift_core::{Event, Profile, ProfileStore, Result};
use tauri::ipc::Channel;
use tokio::sync::broadcast::{error::RecvError, Receiver};

use crate::app_state::AppState;
use crate::{profile_lifecycle, runtime};

pub fn pipe(name: String, a: &str, b: &str) -> Result<()> {
    let profile = Profile {
        name,
        a: a.parse()?,
        b: b.parse()?,
        workflows: Vec::new(),
    };
    let state = AppState::new(ProfileStore::default(), "unused.toml".into())?;
    let sink = runtime::start(&state);
    sink.attach(Channel::new(|_| Ok(())));
    tauri::async_runtime::block_on(serve(&state, profile))
}

async fn serve(state: &AppState, profile: Profile) -> Result<()> {
    let printer = tokio::spawn(print_events(state.rift.subscribe_lifecycle()));
    profile_lifecycle::start(state, profile)?;
    wait_for_shutdown().await?;
    profile_lifecycle::shut_down(state).await;
    printer.abort();
    Ok(())
}

async fn print_events(mut events: Receiver<Event>) {
    loop {
        match events.recv().await {
            Ok(event) => print_event(&event),
            Err(RecvError::Lagged(_)) => continue,
            Err(RecvError::Closed) => return,
        }
    }
}

fn print_event(event: &Event) {
    if let Ok(line) = serde_json::to_string(event) {
        println!("{line}");
    }
}

#[cfg(unix)]
async fn wait_for_shutdown() -> io::Result<()> {
    use tokio::signal::unix::{signal, SignalKind};

    let mut terminate = signal(SignalKind::terminate())?;
    tokio::select! {
        interrupted = tokio::signal::ctrl_c() => interrupted,
        _ = terminate.recv() => Ok(()),
    }
}

#[cfg(not(unix))]
async fn wait_for_shutdown() -> io::Result<()> {
    tokio::signal::ctrl_c().await
}
