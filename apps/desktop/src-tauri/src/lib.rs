mod app_state;
mod commands;
mod event_forwarder;

use tauri::Manager;

use app_state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = AppState::load()?;
            event_forwarder::forward_events(app.handle().clone(), state.rift.subscribe());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_profiles,
            commands::prepare_config_import,
            commands::import_config,
            commands::read_config_file,
            commands::save_profile,
            commands::delete_profile,
            commands::start_profile,
            commands::stop_profile,
            commands::restart_profile,
            commands::set_side_enabled,
            commands::running_profiles,
            commands::bridge_status,
            commands::inject,
            commands::preview_payload,
            commands::list_ports,
            commands::export_log,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Rift");
}
