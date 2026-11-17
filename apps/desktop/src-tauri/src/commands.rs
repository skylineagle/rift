use std::fs;

use rift_core::{
    list_serial_ports, parse_payload, BridgeStatus, Error, PayloadFormat, Profile, Result,
    SerialPortInfo, Side, Target,
};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::State;

use crate::app_state::AppState;
use crate::event_forwarder::EventSink;

#[tauri::command]
pub fn subscribe_events(sink: State<EventSink>, channel: Channel<InvokeResponseBody>) {
    sink.attach(channel);
}

#[tauri::command]
pub fn list_profiles(state: State<AppState>) -> Vec<Profile> {
    state.store.lock().unwrap().list().to_vec()
}

#[tauri::command]
pub fn prepare_config_import(
    content: String,
    filename: String,
    existing_names: Vec<String>,
) -> std::result::Result<Vec<Profile>, String> {
    rift_core::prepare_config_import(&content, &filename, &existing_names)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_config(
    state: State<AppState>,
    content: String,
    filename: String,
) -> std::result::Result<Vec<Profile>, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let names = store
        .list()
        .iter()
        .map(|profile| profile.name.clone())
        .collect::<Vec<_>>();
    let profiles = rift_core::prepare_config_import(&content, &filename, &names)
        .map_err(|error| error.to_string())?;
    store
        .import_atomic(profiles.clone(), &state.config_path)
        .map_err(|error| error.to_string())?;
    Ok(profiles)
}

#[tauri::command]
pub fn read_config_file(path: String) -> std::result::Result<String, String> {
    use std::io::Read;
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    file.take(1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("Configuration exceeds the 1 MiB import limit".into());
    }
    String::from_utf8(bytes).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_profile(
    state: State<AppState>,
    previous_name: Option<String>,
    profile: Profile,
) -> Result<()> {
    let mut store = state.store.lock().unwrap();
    store.upsert(previous_name.as_deref(), profile)?;
    store.save(&state.config_path)
}

#[tauri::command]
pub async fn delete_profile(state: State<'_, AppState>, name: String) -> Result<()> {
    let _ = state.rift.stop(&name).await;
    let mut store = state.store.lock().unwrap();
    store.remove(&name)?;
    store.save(&state.config_path)
}

fn stored_profile(state: &AppState, name: &str) -> Result<Profile> {
    state
        .store
        .lock()
        .unwrap()
        .get(name)
        .cloned()
        .ok_or_else(|| Error::ProfileNotFound(name.to_string()))
}

#[tauri::command]
pub async fn start_profile(state: State<'_, AppState>, name: String) -> Result<()> {
    state.rift.start(stored_profile(&state, &name)?)
}

#[tauri::command]
pub async fn stop_profile(state: State<'_, AppState>, name: String) -> Result<()> {
    state.rift.stop(&name).await
}

#[tauri::command]
pub async fn restart_profile(state: State<'_, AppState>, name: String) -> Result<()> {
    let profile = stored_profile(&state, &name)?;
    let _ = state.rift.stop(&name).await;
    state.rift.start(profile)
}

#[tauri::command]
pub async fn set_side_enabled(
    state: State<'_, AppState>,
    name: String,
    side: Side,
    enabled: bool,
) -> Result<()> {
    if enabled {
        let profile = stored_profile(&state, &name)?;
        let config = match side {
            Side::A => profile.a,
            Side::B => profile.b,
        };
        state.rift.configure_side(&name, side, config).await
    } else {
        state.rift.set_side_enabled(&name, side, false).await
    }
}

#[tauri::command]
pub fn running_profiles(state: State<AppState>) -> Vec<String> {
    state.rift.running()
}

#[tauri::command]
pub fn bridge_status(state: State<AppState>) -> Vec<BridgeStatus> {
    state.rift.status()
}

#[tauri::command]
pub fn inject(
    state: State<AppState>,
    name: String,
    target: String,
    format: String,
    input: String,
) -> Result<()> {
    let target: Target = target.parse()?;
    let format: PayloadFormat = format.parse()?;
    state
        .rift
        .inject(&name, target, parse_payload(format, &input)?)
}

#[tauri::command]
pub fn preview_payload(format: String, input: String) -> Result<Vec<u8>> {
    parse_payload(format.parse()?, &input)
}

#[tauri::command]
pub fn list_ports() -> Result<Vec<SerialPortInfo>> {
    list_serial_ports()
}

#[tauri::command]
pub fn export_log(path: String, content: String) -> Result<()> {
    Ok(fs::write(path, content)?)
}
