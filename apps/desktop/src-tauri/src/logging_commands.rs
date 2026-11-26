use rift_core::{LoggingConfig, Result};
use tauri::State;

use crate::app_state::AppState;

#[tauri::command]
pub fn get_logging_config(state: State<AppState>) -> LoggingConfig {
    state.rift.logger().config()
}

#[tauri::command]
pub fn save_logging_config(state: State<AppState>, config: LoggingConfig) -> Result<()> {
    apply_logging_config(&state, config)
}

#[tauri::command]
pub fn default_log_directory() -> String {
    rift_core::default_log_directory()
        .to_string_lossy()
        .into_owned()
}

fn apply_logging_config(state: &AppState, config: LoggingConfig) -> Result<()> {
    let mut store = state.store.lock().unwrap();
    store.set_section("logging", &config)?;
    store.save(&state.config_path)?;
    state.rift.logger().reconfigure(config);
    Ok(())
}

#[cfg(test)]
mod tests {
    use rift_core::{LogLevel, ProfileStore};

    use super::*;

    #[test]
    fn applied_config_is_persisted_and_active() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("rift.toml");
        let state = AppState::new(ProfileStore::default(), path.clone()).unwrap();
        let config = LoggingConfig {
            level: LogLevel::Warn,
            ..LoggingConfig::default()
        };
        apply_logging_config(&state, config.clone()).unwrap();
        assert_eq!(state.rift.logger().config(), config);
        let reloaded: LoggingConfig = ProfileStore::load(&path)
            .unwrap()
            .section("logging")
            .unwrap();
        assert_eq!(reloaded, config);
    }
}
