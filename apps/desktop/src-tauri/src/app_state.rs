use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rift_core::control::ControlServer;
use rift_core::{
    resolve_config_path, Error, LogRecord, Logger, Profile, ProfileStore, Result, Rift, Workflows,
};

const CONTROL_KIND: &str = "desktop";

pub struct AppState {
    pub rift: Arc<Rift>,
    pub workflows: Arc<Workflows>,
    pub store: Arc<Mutex<ProfileStore>>,
    pub config_path: PathBuf,
    control_server: Mutex<Option<ControlServer>>,
}

impl AppState {
    pub fn load() -> Result<Self> {
        let config_path = resolve_config_path(None)?;
        let store = ProfileStore::load_or_default(&config_path)?;
        Self::new(store, config_path)
    }

    pub fn new(store: ProfileStore, config_path: PathBuf) -> Result<Self> {
        let logger = Logger::with_default_file_name(store.section("logging")?, "rift-desktop.log");
        let rift = Arc::new(Rift::with_logger(logger));
        Ok(Self {
            workflows: Arc::new(Workflows::new(rift.clone())),
            rift,
            store: Arc::new(Mutex::new(store)),
            config_path,
            control_server: Mutex::new(None),
        })
    }

    pub fn stored_profile(&self, name: &str) -> Result<Profile> {
        self.store
            .lock()
            .unwrap()
            .get(name)
            .cloned()
            .ok_or_else(|| Error::ProfileNotFound(name.to_string()))
    }

    pub fn start_control_server(&self) {
        let store = self.store.clone();
        let started = ControlServer::start(
            CONTROL_KIND,
            self.rift.clone(),
            self.workflows.clone(),
            Arc::new(move |name: &str| store.lock().unwrap().get(name).cloned()),
        );
        match started {
            Ok(server) => *self.control_server.lock().unwrap() = Some(server),
            Err(error) => self.rift.logger().log(LogRecord::error(
                "control.failed",
                format!("control server failed to start: {error}"),
            )),
        }
    }

    pub fn stop_control_server(&self) {
        self.control_server.lock().unwrap().take();
    }
}
