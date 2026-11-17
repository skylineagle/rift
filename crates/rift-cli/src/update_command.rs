use std::io::{Cursor, Read};
use std::time::Duration;

use anyhow::{bail, Context, Result};
use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};

use crate::install_source::InstallSource;
use crate::release::{agent, current_version, download, latest_release, Release};
use crate::update_cache::UpdateCache;

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
const TARGET: &str = env!("RIFT_TARGET");

#[cfg(windows)]
const BINARY_NAME: &str = "rift.exe";
#[cfg(not(windows))]
const BINARY_NAME: &str = "rift";

pub async fn update(check_only: bool) -> Result<()> {
    tokio::task::spawn_blocking(move || run(check_only)).await?
}

fn run(check_only: bool) -> Result<()> {
    let agent = agent(DOWNLOAD_TIMEOUT);
    let release = latest_release(&agent)?;
    let latest = release.version()?;
    let current = current_version();
    UpdateCache::record(&latest);
    if latest <= current {
        println!("rift {current} is up to date");
        return Ok(());
    }
    let source = InstallSource::detect();
    if check_only || source != InstallSource::Archive {
        println!(
            "rift {latest} is available (you have {current}), {}",
            source.upgrade_hint()
        );
        return Ok(());
    }
    println!("updating rift {current} → {latest}");
    let binary = download_binary(&agent, &release)?;
    replace_running_binary(&binary)?;
    println!("rift {latest} installed, restart running rift processes to use it");
    Ok(())
}

fn archive_name(release: &Release) -> String {
    let extension = if cfg!(windows) { "zip" } else { "tar.gz" };
    format!("rift-{}-{TARGET}.{extension}", release.tag_name)
}

fn download_binary(agent: &ureq::Agent, release: &Release) -> Result<Vec<u8>> {
    let name = archive_name(release);
    let archive = release
        .asset(&name)
        .with_context(|| format!("release {} has no {name}", release.tag_name))?;
    let checksum = release
        .asset(&format!("{name}.sha256"))
        .with_context(|| format!("release {} has no checksum for {name}", release.tag_name))?;
    let bytes = download(agent, &archive.browser_download_url)?;
    let expected = String::from_utf8(download(agent, &checksum.browser_download_url)?)?;
    verify_checksum(&bytes, &expected)?;
    extract_binary(&bytes)
}

fn verify_checksum(bytes: &[u8], expected: &str) -> Result<()> {
    let actual = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let expected = expected.split_whitespace().next().unwrap_or_default();
    if !actual.eq_ignore_ascii_case(expected) {
        bail!("checksum mismatch, the download is corrupt or was tampered with");
    }
    Ok(())
}

fn extract_binary(archive: &[u8]) -> Result<Vec<u8>> {
    let mut binary = Vec::new();
    if cfg!(windows) {
        let mut zip = zip::ZipArchive::new(Cursor::new(archive))?;
        zip.by_name(BINARY_NAME)?.read_to_end(&mut binary)?;
        return Ok(binary);
    }
    let mut tar = tar::Archive::new(GzDecoder::new(archive));
    for entry in tar.entries()? {
        let mut entry = entry?;
        if entry
            .path()?
            .file_name()
            .is_some_and(|name| name == BINARY_NAME)
        {
            entry.read_to_end(&mut binary)?;
            return Ok(binary);
        }
    }
    bail!("archive does not contain {BINARY_NAME}")
}

fn replace_running_binary(binary: &[u8]) -> Result<()> {
    let directory = std::env::current_exe()?
        .canonicalize()?
        .parent()
        .context("rift has no parent directory")?
        .to_path_buf();
    let staged = tempfile::Builder::new()
        .prefix(".rift-update")
        .tempfile_in(&directory)
        .with_context(|| {
            format!(
                "cannot write to {}, try again with sudo",
                directory.display()
            )
        })?;
    std::fs::write(staged.path(), binary)?;
    make_executable(staged.path())?;
    self_replace::self_replace(staged.path()).context("could not replace the rift binary")?;
    Ok(())
}

#[cfg(unix)]
fn make_executable(path: &std::path::Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[cfg(not(unix))]
fn make_executable(_path: &std::path::Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(not(windows))]
    #[test]
    fn the_binary_is_found_inside_a_release_tarball() {
        let mut tarball = tar::Builder::new(flate2::write::GzEncoder::new(
            Vec::new(),
            flate2::Compression::fast(),
        ));
        let mut header = tar::Header::new_gnu();
        header.set_size(4);
        header.set_mode(0o755);
        header.set_cksum();
        tarball
            .append_data(&mut header, "rift", &b"\x7fELF"[..])
            .unwrap();
        let archive = tarball.into_inner().unwrap().finish().unwrap();
        assert_eq!(extract_binary(&archive).unwrap(), b"\x7fELF");
    }

    #[test]
    fn checksum_accepts_the_sha256sum_line_format() {
        let digest = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
        assert!(verify_checksum(b"hello", &format!("{digest}  rift.tar.gz\n")).is_ok());
        assert!(verify_checksum(b"hellO", digest).is_err());
    }
}
