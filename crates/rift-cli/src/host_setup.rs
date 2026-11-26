use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use rift_core::control::ControlServer;
use rift_core::{Logger, LoggingConfig, Profile, Rift, Workflows};

const HOST_KIND: &str = "cli";
const LOG_DRAIN_DELAY: Duration = Duration::from_millis(200);

pub struct Host {
    pub rift: Arc<Rift>,
    workflows: Arc<Workflows>,
    control: Option<ControlServer>,
}

impl Host {
    pub fn new(logging: LoggingConfig) -> Self {
        let rift = Arc::new(Rift::with_logger(Logger::new(logging)));
        tokio::spawn(rift.logger().clone().watch(rift.subscribe()));
        Self {
            workflows: Arc::new(Workflows::new(rift.clone())),
            rift,
            control: None,
        }
    }

    pub fn start_profiles(&self, profiles: &[Profile]) -> Result<()> {
        for profile in profiles {
            self.rift.start(profile.clone())?;
            for error in self.workflows.start_autostart(profile) {
                eprintln!("error: {}: {error}", profile.name);
            }
        }
        Ok(())
    }

    pub fn accept_remote_commands(&mut self, profiles: Vec<Profile>) {
        let lookup = move |name: &str| {
            profiles
                .iter()
                .find(|profile| profile.name == name)
                .cloned()
        };
        match ControlServer::start(
            HOST_KIND,
            self.rift.clone(),
            self.workflows.clone(),
            Arc::new(lookup),
        ) {
            Ok(control) => self.control = Some(control),
            Err(error) => eprintln!(
                "warning: `rift inject` and `rift workflow` cannot reach this instance: {error}"
            ),
        }
    }

    pub async fn shutdown(self) {
        for profile in self.rift.running() {
            self.workflows.stop_profile(&profile);
        }
        self.rift.stop_all().await;
        tokio::time::sleep(LOG_DRAIN_DELAY).await;
        self.rift.logger().flush();
        drop(self.control);
    }
}
