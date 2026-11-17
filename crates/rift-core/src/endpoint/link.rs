use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use bytes::Bytes;
use tokio::sync::{broadcast, mpsc};
use tokio_util::sync::CancellationToken;

use crate::drops::DropTally;
use crate::event::{ConnectionState, Event, Origin};
use crate::peers::PeerCounter;
use crate::side::Side;

pub(crate) struct Link {
    pub writes: mpsc::Receiver<WriteRequest>,
    pub context: Context,
}

#[derive(Clone)]
pub(crate) struct WriteRequest {
    pub bytes: Bytes,
    receipt: Arc<Receipt>,
}

struct Receipt {
    event: Event,
    events: broadcast::Sender<Event>,
    completed: AtomicBool,
}

impl WriteRequest {
    pub fn new(bytes: Bytes, event: Event, events: broadcast::Sender<Event>) -> Self {
        Self {
            bytes,
            receipt: Arc::new(Receipt {
                event,
                events,
                completed: AtomicBool::new(false),
            }),
        }
    }

    pub fn unavailable(mut self, reason: String) {
        if let Some(receipt) = Arc::get_mut(&mut self.receipt) {
            if let Event::Data {
                undelivered_reason, ..
            } = &mut receipt.event
            {
                *undelivered_reason = Some(reason);
            }
        }
    }

    pub fn report_dropped(&self, peer: Option<String>, chunks: u64) {
        if let Some(reporter) = self.drop_reporter() {
            reporter.report(peer, chunks);
        }
    }

    fn drop_reporter(&self) -> Option<DropReporter> {
        match &self.receipt.event {
            Event::Data {
                profile, target, ..
            } => Some(DropReporter {
                profile: profile.clone(),
                side: *target,
                events: self.receipt.events.clone(),
            }),
            _ => None,
        }
    }

    pub fn delivered(&self) {
        if !self.receipt.completed.swap(true, Ordering::AcqRel) {
            let mut event = self.receipt.event.clone();
            if let Event::Data { timestamp, .. } = &mut event {
                *timestamp = chrono::Utc::now();
            }
            let _ = self.receipt.events.send(event);
        }
    }
}

impl Drop for Receipt {
    fn drop(&mut self) {
        if !self.completed.load(Ordering::Acquire) {
            if let Event::Data {
                origin: Origin::Injected,
                delivered,
                ..
            } = &mut self.event
            {
                *delivered = false;
                let _ = self.events.send(self.event.clone());
            }
        }
    }
}

#[derive(Clone)]
pub(crate) struct Context {
    pub reads: mpsc::Sender<Bytes>,
    pub states: mpsc::Sender<ConnectionState>,
    pub peers: PeerCounter,
    pub cancel: CancellationToken,
}

impl Context {
    pub async fn report(&self, state: ConnectionState) {
        let _ = self.states.send(state).await;
    }

    pub async fn report_error(&self, error: impl std::fmt::Display) {
        self.report(ConnectionState::Error {
            message: error.to_string(),
        })
        .await;
    }

    pub async fn forward(&self, bytes: Bytes) -> bool {
        self.reads.send(bytes).await.is_ok()
    }
}

pub(crate) trait WriteSource {
    async fn next(&mut self) -> Option<WriteRequest>;
}

impl WriteSource for mpsc::Receiver<WriteRequest> {
    async fn next(&mut self) -> Option<WriteRequest> {
        self.recv().await
    }
}

struct DropReporter {
    profile: String,
    side: Side,
    events: broadcast::Sender<Event>,
}

impl DropReporter {
    fn report(&self, peer: Option<String>, chunks: u64) {
        let _ = self
            .events
            .send(Event::dropped(&self.profile, self.side, peer, chunks));
    }
}

pub(crate) struct PeerWrites {
    receiver: broadcast::Receiver<WriteRequest>,
    peer: String,
    drops: DropTally,
    reporter: Option<DropReporter>,
}

impl PeerWrites {
    pub fn new(receiver: broadcast::Receiver<WriteRequest>, peer: String) -> Self {
        Self {
            receiver,
            peer,
            drops: DropTally::default(),
            reporter: None,
        }
    }

    fn flush_drops(&mut self) {
        let Some(reporter) = &self.reporter else {
            return;
        };
        if let Some(chunks) = self.drops.take_due() {
            reporter.report(Some(self.peer.clone()), chunks);
        }
    }
}

impl WriteSource for PeerWrites {
    async fn next(&mut self) -> Option<WriteRequest> {
        loop {
            let due = self.drops.next_due();
            tokio::select! {
                received = self.receiver.recv() => match received {
                    Ok(request) => {
                        if self.reporter.is_none() {
                            self.reporter = request.drop_reporter();
                        }
                        self.flush_drops();
                        return Some(request);
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => self.drops.add(skipped),
                    Err(broadcast::error::RecvError::Closed) => return None,
                },
                _ = tokio::time::sleep_until(due.unwrap_or_else(tokio::time::Instant::now)), if due.is_some() => {
                    self.flush_drops();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::side::Side;

    #[test]
    fn broadcast_success_is_logged_once_after_a_recipient_writes() {
        let (events, mut received) = broadcast::channel(8);
        let bytes = Bytes::from_static(b"hello");
        let request = WriteRequest::new(
            bytes.clone(),
            Event::data("test", Side::A, Side::B, Origin::Forwarded, &bytes, true),
            events,
        );
        let second_recipient = request.clone();
        assert!(received.try_recv().is_err());
        request.delivered();
        second_recipient.delivered();
        assert!(matches!(
            received.try_recv().unwrap(),
            Event::Data {
                origin: Origin::Forwarded,
                delivered: true,
                ..
            }
        ));
        drop(request);
        drop(second_recipient);
        assert!(received.try_recv().is_err());
    }

    #[test]
    fn undelivered_injection_keeps_its_payload_and_is_not_a_success() {
        let (events, mut received) = broadcast::channel(8);
        let bytes = Bytes::from_static(b"hello");
        let request = WriteRequest::new(
            bytes.clone(),
            Event::data("test", Side::A, Side::B, Origin::Injected, &bytes, true),
            events,
        );
        drop(request);
        assert!(
            matches!(received.try_recv().unwrap(), Event::Data { origin: Origin::Injected, delivered: false, bytes, .. } if bytes == b"hello")
        );
    }
}
