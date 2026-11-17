use std::path::PathBuf;

use chrono::{DateTime, Duration, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};

const CHECK_INTERVAL_HOURS: i64 = 24;

#[derive(Serialize, Deserialize)]
pub struct UpdateCache {
    checked_at: DateTime<Utc>,
    latest: Version,
}

impl UpdateCache {
    fn path() -> Option<PathBuf> {
        dirs::cache_dir().map(|directory| directory.join("rift").join("update-check.json"))
    }

    pub fn load() -> Option<Self> {
        let content = std::fs::read(Self::path()?).ok()?;
        serde_json::from_slice(&content).ok()
    }

    pub fn record(latest: &Version) {
        let Some(path) = Self::path() else {
            return;
        };
        let cache = UpdateCache {
            checked_at: Utc::now(),
            latest: latest.clone(),
        };
        if let (Some(directory), Ok(content)) = (path.parent(), serde_json::to_vec(&cache)) {
            let _ = std::fs::create_dir_all(directory);
            let _ = std::fs::write(path, content);
        }
    }

    pub fn is_stale(&self) -> bool {
        Utc::now() - self.checked_at > Duration::hours(CHECK_INTERVAL_HOURS)
    }

    pub fn latest(&self) -> &Version {
        &self.latest
    }
}
