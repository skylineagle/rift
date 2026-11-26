use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, NaiveDateTime, Utc};

use super::config::RotationPolicy;

const TIMESTAMP_FORMAT: &str = "%Y-%m-%dT%H-%M-%S";
const TIMESTAMP_LENGTH: usize = 19;

impl RotationPolicy {
    pub(super) fn period_changed(self, opened: DateTime<Utc>, now: DateTime<Utc>) -> bool {
        let format = match self {
            RotationPolicy::Size => return false,
            RotationPolicy::Hourly => "%Y-%m-%dT%H",
            RotationPolicy::Daily => "%Y-%m-%d",
        };
        opened.format(format).to_string() != now.format(format).to_string()
    }
}

#[derive(Debug)]
struct RotatedFile {
    path: PathBuf,
    timestamp: NaiveDateTime,
    sequence: u32,
    bytes: u64,
}

pub(super) struct LogFiles {
    directory: PathBuf,
    file_name: String,
}

impl LogFiles {
    pub fn new(directory: PathBuf, file_name: String) -> Self {
        Self {
            directory,
            file_name,
        }
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    pub fn current(&self) -> PathBuf {
        self.directory.join(&self.file_name)
    }

    pub fn rotate(&self, now: DateTime<Utc>) -> io::Result<()> {
        let timestamp = now.format(TIMESTAMP_FORMAT).to_string();
        let sequence = self
            .rotated()?
            .iter()
            .filter(|file| file.timestamp.format(TIMESTAMP_FORMAT).to_string() == timestamp)
            .map(|file| file.sequence + 1)
            .max();
        let suffix = sequence.map_or_else(String::new, |sequence| format!("-{sequence}"));
        let (stem, extension) = self.name_parts();
        let target = self
            .directory
            .join(format!("{stem}.{timestamp}{suffix}{extension}"));
        fs::rename(self.current(), target)
    }

    pub fn clean_up(&self, max_files: usize, max_total_bytes: Option<u64>) -> io::Result<()> {
        let mut rotated = self.rotated()?;
        rotated.sort_by_key(|file| (file.timestamp, file.sequence));
        let surplus = match max_files {
            0 => 0,
            limit => rotated.len().saturating_sub(limit),
        };
        for file in rotated.drain(..surplus) {
            fs::remove_file(file.path)?;
        }
        let Some(max_total_bytes) = max_total_bytes else {
            return Ok(());
        };
        let current_bytes = fs::metadata(self.current()).map_or(0, |metadata| metadata.len());
        let mut total = current_bytes + rotated.iter().map(|file| file.bytes).sum::<u64>();
        for file in rotated {
            if total <= max_total_bytes {
                break;
            }
            fs::remove_file(file.path)?;
            total -= file.bytes;
        }
        Ok(())
    }

    fn name_parts(&self) -> (&str, &str) {
        match self.file_name.rfind('.') {
            Some(dot) if dot > 0 => self.file_name.split_at(dot),
            _ => (&self.file_name, ""),
        }
    }

    fn rotated(&self) -> io::Result<Vec<RotatedFile>> {
        let mut files = Vec::new();
        for entry in fs::read_dir(&self.directory)? {
            let entry = entry?;
            let name = entry.file_name();
            let Some((timestamp, sequence)) = name.to_str().and_then(|name| self.parse(name))
            else {
                continue;
            };
            files.push(RotatedFile {
                path: entry.path(),
                timestamp,
                sequence,
                bytes: entry.metadata()?.len(),
            });
        }
        Ok(files)
    }

    fn parse(&self, name: &str) -> Option<(NaiveDateTime, u32)> {
        let (stem, extension) = self.name_parts();
        let middle = name
            .strip_prefix(stem)?
            .strip_prefix('.')?
            .strip_suffix(extension)?;
        let timestamp =
            NaiveDateTime::parse_from_str(middle.get(..TIMESTAMP_LENGTH)?, TIMESTAMP_FORMAT)
                .ok()?;
        let sequence = match middle.get(TIMESTAMP_LENGTH..)? {
            "" => 0,
            suffix => suffix.strip_prefix('-')?.parse().ok()?,
        };
        Some((timestamp, sequence))
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    fn at(hour: u32, minute: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 11, 26, hour, minute, 0).unwrap()
    }

    fn names(directory: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn periods_change_on_utc_hour_or_day() {
        assert!(!RotationPolicy::Size.period_changed(at(1, 0), at(23, 0)));
        assert!(!RotationPolicy::Hourly.period_changed(at(1, 0), at(1, 59)));
        assert!(RotationPolicy::Hourly.period_changed(at(1, 59), at(2, 0)));
        assert!(!RotationPolicy::Daily.period_changed(at(1, 0), at(23, 59)));
        assert!(RotationPolicy::Daily
            .period_changed(at(23, 59), at(23, 59) + chrono::Duration::minutes(1)));
    }

    #[test]
    fn repeated_rotations_in_one_second_stay_ordered() {
        let directory = tempfile::tempdir().unwrap();
        let files = LogFiles::new(directory.path().to_path_buf(), "rift.log".into());
        for content in ["first", "second", "third"] {
            fs::write(files.current(), content).unwrap();
            files.rotate(at(10, 0)).unwrap();
        }
        files.clean_up(2, None).unwrap();
        assert_eq!(
            names(directory.path()),
            [
                "rift.2026-11-26T10-00-00-1.log",
                "rift.2026-11-26T10-00-00-2.log"
            ]
        );
    }

    #[test]
    fn total_size_cap_deletes_oldest_and_ignores_other_files() {
        let directory = tempfile::tempdir().unwrap();
        let files = LogFiles::new(directory.path().to_path_buf(), "rift.log".into());
        fs::write(directory.path().join("other.log"), [0; 100]).unwrap();
        for minute in 1..=3 {
            fs::write(files.current(), [0; 10]).unwrap();
            files.rotate(at(10, minute)).unwrap();
        }
        fs::write(files.current(), [0; 5]).unwrap();
        files.clean_up(0, Some(25)).unwrap();
        assert_eq!(
            names(directory.path()),
            [
                "other.log",
                "rift.2026-11-26T10-02-00.log",
                "rift.2026-11-26T10-03-00.log",
                "rift.log"
            ]
        );
    }

    #[test]
    fn file_names_without_extension_are_rotated() {
        let directory = tempfile::tempdir().unwrap();
        let files = LogFiles::new(directory.path().to_path_buf(), "riftlog".into());
        fs::write(files.current(), "x").unwrap();
        files.rotate(at(10, 0)).unwrap();
        assert_eq!(names(directory.path()), ["riftlog.2026-11-26T10-00-00"]);
        assert_eq!(files.rotated().unwrap().len(), 1);
    }
}
