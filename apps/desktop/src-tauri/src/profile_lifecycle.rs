use std::time::Duration;

use rift_core::{LogRecord, Profile, Result};

use crate::app_state::AppState;

const STOP_TIMEOUT: Duration = Duration::from_secs(3);
const SETTLE_DELAY: Duration = Duration::from_millis(100);

pub fn start(state: &AppState, profile: Profile) -> Result<()> {
    state.rift.start(profile.clone())?;
    for error in state.workflows.start_autostart(&profile) {
        state.rift.logger().log(
            LogRecord::error(
                "workflow.failed",
                format!("{} autostart workflow failed: {error}", profile.name),
            )
            .profile(&profile.name),
        );
    }
    Ok(())
}

pub async fn stop(state: &AppState, name: &str) -> Result<()> {
    state.workflows.stop_profile(name);
    state.rift.stop(name).await
}

pub async fn shut_down(state: &AppState) {
    state.stop_control_server();
    for status in state.workflows.running() {
        state.workflows.stop_profile(&status.profile);
    }
    let _ = tokio::time::timeout(STOP_TIMEOUT, state.rift.stop_all()).await;
    tokio::time::sleep(SETTLE_DELAY).await;
    state.rift.logger().flush();
}

#[cfg(test)]
mod tests {
    use rift_core::ProfileStore;

    use super::*;

    const PROFILE: &str = r#"
[[profile]]
name = "gps"
a = { kind = "tcp-server", bind = "127.0.0.1:0" }
b = { kind = "tcp-server", bind = "127.0.0.1:0" }

[[profile.workflows]]
name = "heartbeat"
autostart = true
steps = [{ action = "wait", millis = 60000 }]

[[profile.workflows]]
name = "manual"
steps = [{ action = "wait", millis = 60000 }]
"#;

    fn state() -> AppState {
        let store: ProfileStore = toml::from_str(PROFILE).unwrap();
        AppState::new(store, "unused.toml".into()).unwrap()
    }

    #[test]
    fn start_runs_autostart_workflows_and_stop_ends_them() {
        tauri::async_runtime::block_on(async {
            let state = state();
            start(&state, state.stored_profile("gps").unwrap()).unwrap();
            let running = state.workflows.running();
            assert_eq!(running.len(), 1);
            assert_eq!(running[0].workflow, "heartbeat");
            stop(&state, "gps").await.unwrap();
            assert!(state.workflows.running().is_empty());
            assert!(state.rift.running().is_empty());
        });
    }

    #[test]
    fn shut_down_stops_every_profile_and_workflow() {
        tauri::async_runtime::block_on(async {
            let state = state();
            start(&state, state.stored_profile("gps").unwrap()).unwrap();
            shut_down(&state).await;
            assert!(state.workflows.running().is_empty());
            assert!(state.rift.running().is_empty());
        });
    }
}
