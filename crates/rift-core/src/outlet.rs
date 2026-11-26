use std::sync::Arc;

use tokio::sync::broadcast;

use crate::event::Event;
use crate::logging::Logger;
use crate::traffic::ProfileCounters;

#[derive(Clone)]
pub(crate) struct EventChannels {
    all: broadcast::Sender<Event>,
    lifecycle: broadcast::Sender<Event>,
}

impl EventChannels {
    pub fn new(capacity: usize) -> Self {
        let (all, _) = broadcast::channel(capacity);
        let (lifecycle, _) = broadcast::channel(capacity);
        Self { all, lifecycle }
    }

    pub fn publish(&self, event: Event) {
        if !matches!(event, Event::Data { .. }) {
            let _ = self.lifecycle.send(event.clone());
        }
        let _ = self.all.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.all.subscribe()
    }

    pub fn subscribe_lifecycle(&self) -> broadcast::Receiver<Event> {
        self.lifecycle.subscribe()
    }
}

pub(crate) struct Outlet {
    pub events: EventChannels,
    pub traffic: Arc<ProfileCounters>,
    pub logger: Option<Logger>,
}

impl Outlet {
    pub fn detached(capacity: usize) -> Self {
        Self {
            events: EventChannels::new(capacity),
            traffic: Arc::default(),
            logger: None,
        }
    }
}
