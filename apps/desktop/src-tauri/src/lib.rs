mod app_state;
#[cfg(target_os = "macos")]
mod cli_link;
mod commands;
mod event_batch;
mod event_forwarder;
mod logging_commands;
mod profile_lifecycle;
mod profile_logging;
mod workflow_commands;

use tauri::{Manager, RunEvent};

use app_state::AppState;
use event_forwarder::EventSink;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            cli_link::link_bundled_cli();
            let state = AppState::load()?;
            let logger = state.rift.logger().clone();
            tauri::async_runtime::spawn(logger.watch(state.rift.subscribe()));
            tauri::async_runtime::block_on(async { state.start_control_server() });
            let sink = EventSink::default();
            event_forwarder::forward_events(sink.clone(), state.rift.subscribe());
            app.manage(state);
            app.manage(sink);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::subscribe_events,
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
            logging_commands::get_logging_config,
            logging_commands::save_logging_config,
            logging_commands::default_log_directory,
            workflow_commands::start_workflow,
            workflow_commands::stop_workflow,
            workflow_commands::running_workflows,
            workflow_commands::validate_workflow,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Rift")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                let state = app.state::<AppState>();
                tauri::async_runtime::block_on(profile_lifecycle::shut_down(&state));
            }
        });
}
