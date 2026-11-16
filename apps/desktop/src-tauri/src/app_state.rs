use std::path::PathBuf;
use std::sync::Mutex;

use rift_core::{resolve_config_path, ProfileStore, Result, Rift};

pub struct AppState {
    pub rift: Rift,
    pub store: Mutex<ProfileStore>,
    pub config_path: PathBuf,
}

impl AppState {
    pub fn load() -> Result<Self> {
        let config_path = resolve_config_path(None)?;
        let store = ProfileStore::load_or_default(&config_path)?;
        Ok(Self {
            rift: Rift::new(),
            store: Mutex::new(store),
            config_path,
        })
    }
}
