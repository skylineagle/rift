use rift_core::Event;
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast::{error::RecvError, Receiver};

const EVENT_NAME: &str = "rift://event";

pub fn forward_events(app: AppHandle, mut events: Receiver<Event>) {
    tauri::async_runtime::spawn(async move {
        loop {
            match events.recv().await {
                Ok(event) => {
                    let _ = app.emit(EVENT_NAME, event);
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });
}
