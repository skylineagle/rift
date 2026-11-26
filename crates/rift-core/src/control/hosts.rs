use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

const HOSTS_DIRECTORY_VARIABLE: &str = "RIFT_HOSTS_DIR";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(super) struct HostRecord {
    pub pid: u32,
    pub port: u16,
    pub token: String,
    pub kind: String,
}

pub(super) fn hosts_directory() -> Result<PathBuf> {
    if let Some(directory) = std::env::var_os(HOSTS_DIRECTORY_VARIABLE) {
        return Ok(directory.into());
    }
    dirs::data_local_dir()
        .map(|directory| directory.join("rift").join("hosts"))
        .ok_or_else(|| Error::Control("cannot determine the hosts directory".to_string()))
}

pub(super) fn generate_token() -> Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|error| Error::Control(format!("cannot generate a token: {error}")))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

pub(super) fn register(directory: &Path, record: &HostRecord) -> Result<PathBuf> {
    fs::create_dir_all(directory)?;
    let path = directory.join(format!("{}.json", record.pid));
    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    restrict_to_owner(file.as_file())?;
    let content = serde_json::to_vec(record).map_err(|error| Error::Control(error.to_string()))?;
    file.write_all(&content)?;
    file.persist(&path).map_err(|error| error.error)?;
    Ok(path)
}

#[cfg(unix)]
fn restrict_to_owner(file: &fs::File) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn restrict_to_owner(_file: &fs::File) -> Result<()> {
    Ok(())
}

pub(super) fn read_all(directory: &Path) -> Result<Vec<(PathBuf, HostRecord)>> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.into()),
    };
    let mut hosts: Vec<(PathBuf, HostRecord)> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .filter_map(|path| {
            let record = serde_json::from_slice(&fs::read(&path).ok()?).ok()?;
            Some((path, record))
        })
        .collect();
    hosts.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(hosts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_and_reads_back_records() {
        let directory = tempfile::tempdir().unwrap();
        let record = HostRecord {
            pid: 42,
            port: 9,
            token: generate_token().unwrap(),
            kind: "cli".into(),
        };
        let path = register(directory.path(), &record).unwrap();
        fs::write(directory.path().join("broken.json"), "{").unwrap();
        assert_eq!(
            read_all(directory.path()).unwrap(),
            vec![(path.clone(), record)]
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn missing_directory_has_no_hosts() {
        let directory = tempfile::tempdir().unwrap();
        assert!(read_all(&directory.path().join("absent"))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn tokens_are_long_and_distinct() {
        let token = generate_token().unwrap();
        assert_eq!(token.len(), 64);
        assert_ne!(token, generate_token().unwrap());
    }
}
