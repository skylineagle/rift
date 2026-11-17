use std::time::Duration;

use tokio::time::Instant;

const REPORT_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Default)]
pub(crate) struct DropTally {
    pending: u64,
    last_report: Option<Instant>,
}

impl DropTally {
    pub fn add(&mut self, chunks: u64) {
        self.pending += chunks;
    }

    pub fn next_due(&self) -> Option<Instant> {
        (self.pending > 0).then(|| {
            self.last_report
                .map_or_else(Instant::now, |reported| reported + REPORT_INTERVAL)
        })
    }

    pub fn take_due(&mut self) -> Option<u64> {
        let waiting = self
            .last_report
            .is_some_and(|reported| reported.elapsed() < REPORT_INTERVAL);
        if self.pending == 0 || waiting {
            return None;
        }
        self.last_report = Some(Instant::now());
        Some(std::mem::take(&mut self.pending))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn first_drop_reports_at_once_then_rolls_up_per_interval() {
        let mut tally = DropTally::default();
        tally.add(3);
        assert_eq!(tally.take_due(), Some(3));
        tally.add(2);
        tally.add(4);
        assert_eq!(tally.take_due(), None);
        tokio::time::advance(REPORT_INTERVAL).await;
        assert_eq!(tally.take_due(), Some(6));
        assert_eq!(tally.take_due(), None);
    }
}
