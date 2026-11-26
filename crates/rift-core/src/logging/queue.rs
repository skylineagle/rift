use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, SyncSender, TryRecvError, TrySendError};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use super::record::LogRecord;

const DELIVERY_RETRY_DELAY: Duration = Duration::from_millis(1);

pub(super) struct Outbox<T> {
    sender: SyncSender<T>,
    dropped: Arc<AtomicU64>,
}

pub(super) struct Inbox<T> {
    receiver: Receiver<T>,
    dropped: Arc<AtomicU64>,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Received<T> {
    Item(T),
    Dropped(u64),
    TimedOut,
    Closed,
}

pub(super) fn bounded<T>(capacity: usize) -> (Outbox<T>, Inbox<T>) {
    let (sender, receiver) = mpsc::sync_channel(capacity);
    let dropped = Arc::new(AtomicU64::new(0));
    (
        Outbox {
            sender,
            dropped: dropped.clone(),
        },
        Inbox { receiver, dropped },
    )
}

impl<T> Outbox<T> {
    pub fn offer(&self, item: T) {
        if let Err(TrySendError::Full(_)) = self.sender.try_send(item) {
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn deliver(&self, mut item: T, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        loop {
            match self.sender.try_send(item) {
                Ok(()) => return true,
                Err(TrySendError::Full(rejected)) if Instant::now() < deadline => {
                    item = rejected;
                    thread::sleep(DELIVERY_RETRY_DELAY);
                }
                Err(_) => return false,
            }
        }
    }
}

impl<T> Inbox<T> {
    pub fn receive(&self, wait: Duration) -> Received<T> {
        match self.receiver.try_recv() {
            Ok(item) => Received::Item(item),
            Err(TryRecvError::Disconnected) => self.report_or(Received::Closed),
            Err(TryRecvError::Empty) => match self.take_dropped() {
                Some(count) => Received::Dropped(count),
                None => self.wait_for_item(wait),
            },
        }
    }

    pub fn take_dropped(&self) -> Option<u64> {
        Some(self.dropped.swap(0, Ordering::Relaxed)).filter(|count| *count > 0)
    }

    fn report_or(&self, otherwise: Received<T>) -> Received<T> {
        self.take_dropped().map_or(otherwise, Received::Dropped)
    }

    fn wait_for_item(&self, wait: Duration) -> Received<T> {
        match self.receiver.recv_timeout(wait) {
            Ok(item) => Received::Item(item),
            Err(RecvTimeoutError::Timeout) => Received::TimedOut,
            Err(RecvTimeoutError::Disconnected) => Received::Closed,
        }
    }
}

pub(super) fn dropped_record(count: u64) -> LogRecord {
    LogRecord::warn("logging.dropped", format!("dropped {count} log records"))
        .field("records", count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_overflow_and_reports_it_once_drained() {
        let (outbox, inbox) = bounded(2);
        for item in 0..5 {
            outbox.offer(item);
        }
        assert!(!outbox.deliver(9, Duration::from_millis(5)));
        for expected in [
            Received::Item(0),
            Received::Item(1),
            Received::Dropped(3),
            Received::TimedOut,
        ] {
            assert_eq!(inbox.receive(Duration::from_millis(1)), expected);
        }
        drop(outbox);
        assert_eq!(inbox.receive(Duration::MAX), Received::Closed);
    }
}
