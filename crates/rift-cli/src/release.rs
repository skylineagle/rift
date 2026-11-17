use std::time::Duration;

use anyhow::{Context, Result};
use semver::Version;
use serde::Deserialize;
use ureq::Agent;

const LATEST_RELEASE_URL: &str = "https://api.github.com/repos/skylineagle/rift/releases/latest";
const USER_AGENT: &str = "rift-cli";
const MAX_DOWNLOAD_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Deserialize)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
}

#[derive(Deserialize)]
pub struct Release {
    pub tag_name: String,
    pub assets: Vec<Asset>,
}

impl Release {
    pub fn version(&self) -> Result<Version> {
        Ok(Version::parse(self.tag_name.trim_start_matches('v'))?)
    }

    pub fn asset(&self, name: &str) -> Option<&Asset> {
        self.assets.iter().find(|asset| asset.name == name)
    }
}

pub fn current_version() -> Version {
    Version::parse(env!("CARGO_PKG_VERSION")).expect("crate version is valid semver")
}

pub fn agent(timeout: Duration) -> Agent {
    Agent::config_builder()
        .timeout_global(Some(timeout))
        .build()
        .into()
}

pub fn latest_release(agent: &Agent) -> Result<Release> {
    agent
        .get(LATEST_RELEASE_URL)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .call()
        .context("could not reach GitHub releases")?
        .body_mut()
        .read_json()
        .context("unexpected GitHub release response")
}

pub fn download(agent: &Agent, url: &str) -> Result<Vec<u8>> {
    agent
        .get(url)
        .header("User-Agent", USER_AGENT)
        .call()
        .with_context(|| format!("could not download {url}"))?
        .body_mut()
        .with_config()
        .limit(MAX_DOWNLOAD_BYTES)
        .read_to_vec()
        .with_context(|| format!("could not download {url}"))
}
