use rift_core::{Error, Result, Workflow, WorkflowStatus};
use tauri::State;

use crate::app_state::AppState;

#[tauri::command]
pub async fn start_workflow(
    state: State<'_, AppState>,
    name: String,
    workflow: String,
) -> Result<()> {
    start_stored_workflow(&state, &name, &workflow)
}

#[tauri::command]
pub fn stop_workflow(state: State<AppState>, name: String, workflow: String) -> Result<()> {
    state.workflows.stop(&name, &workflow)
}

#[tauri::command]
pub fn running_workflows(state: State<AppState>) -> Vec<WorkflowStatus> {
    state.workflows.running()
}

#[tauri::command]
pub fn validate_workflow(workflow: Workflow) -> Result<()> {
    workflow.validate()
}

fn start_stored_workflow(state: &AppState, name: &str, workflow: &str) -> Result<()> {
    if !state.rift.running().iter().any(|running| running == name) {
        return Err(Error::NotRunning(name.to_string()));
    }
    let stored = state
        .stored_profile(name)?
        .workflows
        .into_iter()
        .find(|candidate| candidate.name == workflow)
        .ok_or_else(|| Error::WorkflowNotFound(workflow.to_string()))?;
    state.workflows.start(name, stored)
}

#[cfg(test)]
mod tests {
    use rift_core::ProfileStore;

    use super::*;
    use crate::profile_lifecycle;

    #[test]
    fn starts_stored_workflows_of_running_profiles_only() {
        let store: ProfileStore = toml::from_str(
            r#"
[[profile]]
name = "gps"
a = { kind = "tcp-server", bind = "127.0.0.1:0" }
b = { kind = "tcp-server", bind = "127.0.0.1:0" }

[[profile.workflows]]
name = "heartbeat"
steps = [{ action = "wait", millis = 60000 }]
"#,
        )
        .unwrap();
        let state = AppState::new(store, "unused.toml".into()).unwrap();
        tauri::async_runtime::block_on(async {
            assert!(matches!(
                start_stored_workflow(&state, "gps", "heartbeat"),
                Err(Error::NotRunning(_))
            ));
            profile_lifecycle::start(&state, state.stored_profile("gps").unwrap()).unwrap();
            assert!(matches!(
                start_stored_workflow(&state, "gps", "missing"),
                Err(Error::WorkflowNotFound(_))
            ));
            start_stored_workflow(&state, "gps", "heartbeat").unwrap();
            assert_eq!(state.workflows.running().len(), 1);
            profile_lifecycle::shut_down(&state).await;
        });
    }
}
