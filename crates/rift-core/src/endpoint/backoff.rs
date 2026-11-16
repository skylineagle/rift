use std::time::Duration;

const MAXIMUM: Duration = Duration::from_secs(10);

pub(crate) struct Backoff {
    initial: Duration,
    maximum: Duration,
    current: Duration,
}

impl Backoff {
    pub fn new(initial: Duration) -> Self {
        Self {
            initial,
            maximum: MAXIMUM.max(initial),
            current: initial,
        }
    }

    pub fn reset(&mut self) {
        self.current = self.initial;
    }

    pub fn next_delay(&mut self) -> Duration {
        let delay = self.current;
        self.current = (self.current * 2).min(self.maximum);
        delay
    }
}
