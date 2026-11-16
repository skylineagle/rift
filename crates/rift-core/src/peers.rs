use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Clone, Default)]
pub(crate) struct PeerCounter(Arc<AtomicUsize>);

impl PeerCounter {
    pub fn joined(&self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }

    pub fn left(&self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }

    pub fn count(&self) -> usize {
        self.0.load(Ordering::SeqCst)
    }

    pub fn is_connected(&self) -> bool {
        self.count() > 0
    }
}
