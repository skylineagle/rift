use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use bytes::Bytes;
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio_util::sync::CancellationToken;

use crate::drops::DropTally;
use crate::event::{ConnectionState, Event, Origin};
use crate::logging::Injection;
use crate::outlet::Outlet;
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
    outlet: Arc<Outlet>,
    completed: AtomicBool,
    confirmation: Mutex<Option<oneshot::Sender<()>>>,
}

impl WriteRequest {
    pub fn new(bytes: Bytes, event: Event, outlet: Arc<Outlet>) -> Self {
        Self {
            bytes,
            receipt: Arc::new(Receipt {
                event,
                outlet,
                completed: AtomicBool::new(false),
                confirmation: Mutex::new(None),
            }),
        }
    }

    pub fn confirming(self, confirmation: Option<oneshot::Sender<()>>) -> Self {
        *self.receipt.confirmation.lock().unwrap() = confirmation;
        self
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
                outlet: self.receipt.outlet.clone(),
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
            self.receipt.settle(event);
            if let Some(confirmation) = self.receipt.confirmation.lock().unwrap().take() {
                let _ = confirmation.send(());
            }
        }
    }
}

impl Receipt {
    fn settle(&self, event: Event) {
        self.account(&event);
        self.outlet.events.publish(event);
    }

    fn account(&self, event: &Event) {
        let Event::Data {
            profile,
            target,
            origin,
            bytes,
            delivered,
            undelivered_reason,
            ..
        } = event
        else {
            return;
        };
        let counters = self.outlet.traffic.side(*target);
        if *delivered {
            counters.record_delivered(*origin, bytes.len());
        } else {
            counters.record_undelivered(*origin, bytes.len());
        }
        if let (Origin::Injected, Some(logger)) = (origin, &self.outlet.logger) {
            logger.log_injection(Injection {
                profile,
                target: *target,
                bytes: bytes.len(),
                delivered: *delivered,
                undelivered_reason: undelivered_reason.as_deref(),
            });
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
                self.settle(self.event.clone());
            }
        }
    }
}

pub(crate) struct Inbound {
    pub bytes: Bytes,
    pub confirmation: Option<oneshot::Sender<()>>,
    pub retried: bool,
}

#[derive(Clone)]
pub(crate) struct Context {
    pub reads: mpsc::Sender<Inbound>,
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
        let inbound = Inbound {
            bytes,
            confirmation: None,
            retried: false,
        };
        self.reads.send(inbound).await.is_ok()
    }

    pub async fn forward_confirmed(&self, bytes: Bytes) -> Option<oneshot::Receiver<()>> {
        self.send_confirmed(bytes, false).await
    }

    pub async fn retry_confirmed(&self, bytes: Bytes) -> Option<oneshot::Receiver<()>> {
        self.send_confirmed(bytes, true).await
    }

    async fn send_confirmed(&self, bytes: Bytes, retried: bool) -> Option<oneshot::Receiver<()>> {
        let (confirmation, confirmed) = oneshot::channel();
        let inbound = Inbound {
            bytes,
            confirmation: Some(confirmation),
            retried,
        };
        self.reads.send(inbound).await.ok().map(|()| confirmed)
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
    outlet: Arc<Outlet>,
}

impl DropReporter {
    fn report(&self, peer: Option<String>, chunks: u64) {
        self.outlet
            .events
            .publish(Event::dropped(&self.profile, self.side, peer, chunks));
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
        let outlet = Arc::new(Outlet::detached(8));
        let mut received = outlet.events.subscribe();
        let bytes = Bytes::from_static(b"hello");
        let request = WriteRequest::new(
            bytes.clone(),
            Event::data("test", Side::A, Side::B, Origin::Forwarded, &bytes, true),
            outlet,
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
    fn confirmation_resolves_only_after_a_successful_write() {
        let outlet = Arc::new(Outlet::detached(8));
        let bytes = Bytes::from_static(b"hello");
        let request = |confirmation| {
            let event = Event::data("test", Side::A, Side::B, Origin::Forwarded, &bytes, true);
            WriteRequest::new(bytes.clone(), event, outlet.clone()).confirming(Some(confirmation))
        };
        let (sender, mut written) = oneshot::channel();
        let delivered = request(sender);
        let other_recipient = delivered.clone();
        assert_eq!(written.try_recv(), Err(oneshot::error::TryRecvError::Empty));
        delivered.delivered();
        assert_eq!(written.try_recv(), Ok(()));
        drop(other_recipient);
        let (sender, mut dropped) = oneshot::channel();
        drop(request(sender));
        assert_eq!(
            dropped.try_recv(),
            Err(oneshot::error::TryRecvError::Closed)
        );
    }

    #[test]
    fn undelivered_injection_keeps_its_payload_and_is_not_a_success() {
        let outlet = Arc::new(Outlet::detached(8));
        let mut received = outlet.events.subscribe();
        let bytes = Bytes::from_static(b"hello");
        let request = WriteRequest::new(
            bytes.clone(),
            Event::data("test", Side::A, Side::B, Origin::Injected, &bytes, true),
            outlet,
        );
        drop(request);
        assert!(
            matches!(received.try_recv().unwrap(), Event::Data { origin: Origin::Injected, delivered: false, bytes, .. } if bytes == b"hello")
        );
    }
}
