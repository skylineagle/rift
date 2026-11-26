use crate::app_state::AppState;
use crate::event_forwarder::{self, EventSink};

pub fn start(state: &AppState) -> EventSink {
    let logger = state.rift.logger().clone();
    tauri::async_runtime::spawn(logger.watch(
        state.rift.subscribe_lifecycle(),
        state.rift.traffic_registry(),
    ));
    tauri::async_runtime::block_on(async { state.start_control_server() });
    let sink = EventSink::default();
    event_forwarder::forward_events(sink.clone(), state.rift.subscribe());
    sink
}
