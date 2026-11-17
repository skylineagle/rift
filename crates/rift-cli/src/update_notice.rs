use std::io::IsTerminal;
use std::time::Duration;

use semver::Version;

use crate::install_source::InstallSource;
use crate::release::{agent, current_version, latest_release};
use crate::update_cache::UpdateCache;

const CHECK_TIMEOUT: Duration = Duration::from_secs(5);
const OPT_OUT_VARIABLE: &str = "RIFT_NO_UPDATE_CHECK";

pub fn announce_updates() {
    if !std::io::stderr().is_terminal() || std::env::var_os(OPT_OUT_VARIABLE).is_some() {
        return;
    }
    let cache = UpdateCache::load();
    let announced = cache
        .as_ref()
        .is_some_and(|cache| announce_if_newer(cache.latest()));
    if cache.as_ref().is_none_or(UpdateCache::is_stale) {
        std::thread::spawn(move || refresh(announced));
    }
}

fn refresh(announced: bool) {
    let Ok(latest) = latest_release(&agent(CHECK_TIMEOUT)).and_then(|release| release.version())
    else {
        return;
    };
    UpdateCache::record(&latest);
    if !announced {
        announce_if_newer(&latest);
    }
}

fn announce_if_newer(latest: &Version) -> bool {
    let current = current_version();
    if latest <= &current {
        return false;
    }
    eprintln!(
        "rift {latest} is available (you have {current}), {} · set {OPT_OUT_VARIABLE}=1 to hide this",
        InstallSource::detect().upgrade_hint()
    );
    true
}
