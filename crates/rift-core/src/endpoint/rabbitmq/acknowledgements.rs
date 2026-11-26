use std::collections::BTreeMap;
use std::time::Duration;

use bytes::Bytes;
use tokio::sync::oneshot;
use tokio::task::JoinSet;
use tokio::time::{sleep_until, Instant};

const MINIMUM_RETRY_DELAY: Duration = Duration::from_millis(100);

#[derive(Debug, PartialEq, Eq)]
pub(super) struct Held {
    pub delivery_tag: u64,
    pub content: Bytes,
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Settlement {
    Acknowledge(u64),
    Retry(Vec<Held>),
}

pub(super) struct Acknowledgements {
    attempts: JoinSet<(Held, bool)>,
    failed: BTreeMap<u64, Bytes>,
    retry_at: Instant,
    retry_delay: Duration,
}

impl Acknowledgements {
    pub fn new(retry_delay: Duration) -> Self {
        Self {
            attempts: JoinSet::new(),
            failed: BTreeMap::new(),
            retry_at: Instant::now(),
            retry_delay: retry_delay.max(MINIMUM_RETRY_DELAY),
        }
    }

    pub fn track(&mut self, held: Held, confirmation: oneshot::Receiver<()>) {
        self.attempts.spawn(async move {
            let delivered = confirmation.await.is_ok();
            (held, delivered)
        });
    }

    pub async fn next(&mut self) -> Settlement {
        loop {
            tokio::select! {
                Some(Ok((held, delivered))) = self.attempts.join_next() => {
                    if delivered {
                        return Settlement::Acknowledge(held.delivery_tag);
                    }
                    self.hold(held);
                }
                _ = sleep_until(self.retry_at), if !self.failed.is_empty() => {
                    return Settlement::Retry(self.take_failed());
                }
                else => return std::future::pending().await,
            }
        }
    }

    fn hold(&mut self, held: Held) {
        if self.failed.is_empty() {
            self.retry_at = Instant::now() + self.retry_delay;
        }
        self.failed.insert(held.delivery_tag, held.content);
    }

    fn take_failed(&mut self) -> Vec<Held> {
        std::mem::take(&mut self.failed)
            .into_iter()
            .map(|(delivery_tag, content)| Held {
                delivery_tag,
                content,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn held(delivery_tag: u64) -> Held {
        Held {
            delivery_tag,
            content: Bytes::from(delivery_tag.to_string()),
        }
    }

    #[tokio::test(start_paused = true)]
    async fn failed_deliveries_are_retried_in_order_after_the_delay() {
        let mut acknowledgements = Acknowledgements::new(Duration::from_secs(1));
        let (written, confirmation) = oneshot::channel();
        acknowledgements.track(held(3), confirmation);
        for delivery_tag in [2, 1] {
            acknowledgements.track(held(delivery_tag), oneshot::channel().1);
        }
        written.send(()).unwrap();
        let started = Instant::now();
        assert_eq!(acknowledgements.next().await, Settlement::Acknowledge(3));
        assert_eq!(
            acknowledgements.next().await,
            Settlement::Retry(vec![held(1), held(2)])
        );
        assert!(started.elapsed() >= Duration::from_secs(1));
    }
}
