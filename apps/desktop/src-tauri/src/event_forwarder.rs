use std::sync::{Arc, Mutex};
use std::time::Duration;

use rift_core::Event;
use tauri::ipc::{Channel, InvokeResponseBody};
use tokio::sync::broadcast::{error::RecvError, Receiver};

use crate::event_batch::EventBatch;

const FLUSH_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Clone, Default)]
pub struct EventSink(Arc<Mutex<Option<Channel<InvokeResponseBody>>>>);

impl EventSink {
    pub fn attach(&self, channel: Channel<InvokeResponseBody>) {
        *self.0.lock().unwrap() = Some(channel);
    }

    fn send(&self, batch: EventBatch) {
        if let Some(channel) = self.0.lock().unwrap().as_ref() {
            let _ = channel.send(InvokeResponseBody::Raw(batch.encode()));
        }
    }
}

pub fn forward_events(sink: EventSink, mut events: Receiver<Event>) {
    tauri::async_runtime::spawn(async move {
        let mut flush = tokio::time::interval(FLUSH_INTERVAL);
        let mut batch = EventBatch::default();
        loop {
            tokio::select! {
                received = events.recv() => match received {
                    Ok(event) => batch.push(event),
                    Err(RecvError::Lagged(missed)) => batch.lagged(missed),
                    Err(RecvError::Closed) => break,
                },
                _ = flush.tick() => {
                    if !batch.is_empty() {
                        sink.send(std::mem::take(&mut batch));
                    }
                }
            }
        }
    });
}
