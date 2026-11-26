use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tokio_util::sync::CancellationToken;

use crate::error::{Error, Result};
use crate::event::{ConnectionState, Event, WorkflowState};
use crate::logging::LogRecord;
use crate::manager::Rift;
use crate::profile::Profile;
use crate::side::{Side, Target};
use crate::workflow::{PreparedStep, Workflow};

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct WorkflowStatus {
    pub profile: String,
    pub workflow: String,
    pub cycle: u32,
    pub step: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct WorkflowKey {
    profile: String,
    workflow: String,
}

struct RunningWorkflow {
    id: u64,
    cancellation: CancellationToken,
    cycle: u32,
    step: usize,
}

type Registry = Arc<Mutex<HashMap<WorkflowKey, RunningWorkflow>>>;

pub struct Workflows {
    rift: Arc<Rift>,
    registry: Registry,
    next_id: AtomicU64,
}

#[derive(Debug)]
enum Outcome {
    Finished,
    Stopped,
    Failed(Error),
}

impl Workflows {
    pub fn new(rift: Arc<Rift>) -> Self {
        Self {
            rift,
            registry: Registry::default(),
            next_id: AtomicU64::new(0),
        }
    }

    pub fn start(&self, profile: &str, workflow: Workflow) -> Result<()> {
        self.launch(profile, workflow, false)
    }

    fn launch(&self, profile: &str, workflow: Workflow, await_sides: bool) -> Result<()> {
        let steps = workflow.prepare()?;
        let key = workflow_key(profile, &workflow.name);
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let cancellation = CancellationToken::new();
        {
            let mut registry = self.registry.lock().unwrap();
            if registry.contains_key(&key) {
                return Err(Error::WorkflowRunning(workflow.name));
            }
            registry.insert(
                key.clone(),
                RunningWorkflow {
                    id,
                    cancellation: cancellation.clone(),
                    cycle: 1,
                    step: 0,
                },
            );
            publish(&self.rift, &key, WorkflowState::Started);
        }
        self.rift.logger().log(record(
            LogRecord::info("workflow.started", describe(&key, "started")),
            &key,
        ));
        let rift = self.rift.clone();
        let registry = self.registry.clone();
        tokio::spawn(async move {
            let ready = !await_sides
                || wait_for_sides(&rift, &key.profile, &targeted_sides(&steps), &cancellation)
                    .await;
            let outcome = if ready {
                run_steps(
                    &steps,
                    workflow.repeat,
                    &cancellation,
                    |cycle, step| advance(&rift, &registry, &key, id, cycle, step),
                    |target, bytes| rift.inject(&key.profile, target, bytes),
                )
                .await
            } else {
                Outcome::Stopped
            };
            conclude(&rift, &registry, &key, id, outcome);
        });
        Ok(())
    }

    pub fn stop(&self, profile: &str, workflow: &str) -> Result<()> {
        let key = workflow_key(profile, workflow);
        let mut registry = self.registry.lock().unwrap();
        let running = registry
            .remove(&key)
            .ok_or_else(|| Error::WorkflowNotRunning(workflow.to_string()))?;
        running.cancellation.cancel();
        publish(&self.rift, &key, WorkflowState::Stopped);
        Ok(())
    }

    pub fn stop_profile(&self, profile: &str) {
        self.registry.lock().unwrap().retain(|key, running| {
            let keep = key.profile != profile;
            if !keep {
                running.cancellation.cancel();
                publish(&self.rift, key, WorkflowState::Stopped);
            }
            keep
        });
    }

    pub fn start_autostart(&self, profile: &Profile) -> Vec<Error> {
        profile
            .workflows
            .iter()
            .filter(|workflow| workflow.autostart)
            .filter_map(|workflow| self.launch(&profile.name, workflow.clone(), true).err())
            .collect()
    }

    pub fn running(&self) -> Vec<WorkflowStatus> {
        let mut statuses: Vec<WorkflowStatus> = self
            .registry
            .lock()
            .unwrap()
            .iter()
            .map(|(key, running)| WorkflowStatus {
                profile: key.profile.clone(),
                workflow: key.workflow.clone(),
                cycle: running.cycle,
                step: running.step,
            })
            .collect();
        statuses.sort();
        statuses
    }
}

fn workflow_key(profile: &str, workflow: &str) -> WorkflowKey {
    WorkflowKey {
        profile: profile.to_string(),
        workflow: workflow.to_string(),
    }
}

fn publish(rift: &Rift, key: &WorkflowKey, state: WorkflowState) {
    rift.publish(Event::workflow(&key.profile, &key.workflow, state));
}

fn advance(rift: &Rift, registry: &Registry, key: &WorkflowKey, id: u64, cycle: u32, step: usize) {
    let mut registry = registry.lock().unwrap();
    if let Some(running) = registry.get_mut(key).filter(|running| running.id == id) {
        running.cycle = cycle;
        running.step = step;
        publish(rift, key, WorkflowState::Step { cycle, step });
    }
}

fn conclude(rift: &Rift, registry: &Registry, key: &WorkflowKey, id: u64, outcome: Outcome) {
    {
        let mut registry = registry.lock().unwrap();
        if registry.get(key).is_some_and(|running| running.id == id) {
            registry.remove(key);
            publish(rift, key, outcome.state());
        }
    }
    rift.logger().log(outcome_record(key, outcome));
}

impl Outcome {
    fn state(&self) -> WorkflowState {
        match self {
            Outcome::Finished => WorkflowState::Finished,
            Outcome::Stopped => WorkflowState::Stopped,
            Outcome::Failed(error) => WorkflowState::Failed {
                message: error.to_string(),
            },
        }
    }
}

fn describe(key: &WorkflowKey, change: &str) -> String {
    format!("{} workflow {} {change}", key.profile, key.workflow)
}

fn record(record: LogRecord, key: &WorkflowKey) -> LogRecord {
    record
        .profile(&key.profile)
        .field("workflow", &key.workflow)
}

fn outcome_record(key: &WorkflowKey, outcome: Outcome) -> LogRecord {
    let log_record = match outcome {
        Outcome::Finished => LogRecord::info("workflow.finished", describe(key, "finished")),
        Outcome::Stopped => LogRecord::info("workflow.stopped", describe(key, "stopped")),
        Outcome::Failed(error) => LogRecord::error(
            "workflow.failed",
            describe(key, &format!("failed: {error}")),
        ),
    };
    record(log_record, key)
}

fn targeted_sides(steps: &[PreparedStep]) -> Vec<Side> {
    [Side::A, Side::B]
        .into_iter()
        .filter(|side| {
            steps.iter().any(|step| match step {
                PreparedStep::Send { target, .. } => target.sides().contains(side),
                PreparedStep::Wait(_) => false,
            })
        })
        .collect()
}

fn sides_connected(rift: &Rift, profile: &str, sides: &[Side]) -> Option<bool> {
    let status = rift
        .status()
        .into_iter()
        .find(|status| status.profile == profile)?;
    Some(sides.iter().all(|side| {
        let side_status = match side {
            Side::A => &status.a,
            Side::B => &status.b,
        };
        side_status.peers > 0 || matches!(side_status.state, ConnectionState::Connected { .. })
    }))
}

async fn wait_for_sides(
    rift: &Rift,
    profile: &str,
    sides: &[Side],
    cancellation: &CancellationToken,
) -> bool {
    let mut events = rift.subscribe();
    loop {
        match sides_connected(rift, profile, sides) {
            Some(true) => return true,
            Some(false) => {}
            None => return false,
        }
        tokio::select! {
            _ = cancellation.cancelled() => return false,
            received = events.recv() => {
                if matches!(received, Err(broadcast::error::RecvError::Closed)) {
                    return false;
                }
            }
        }
    }
}

async fn run_steps(
    steps: &[PreparedStep],
    repeat: Option<u32>,
    cancellation: &CancellationToken,
    mut on_step: impl FnMut(u32, usize),
    mut inject: impl FnMut(Target, Bytes) -> Result<()>,
) -> Outcome {
    let mut completed_cycles = 0u32;
    while repeat.is_none_or(|cycles| completed_cycles < cycles) {
        for (index, step) in steps.iter().enumerate() {
            if cancellation.is_cancelled() {
                return Outcome::Stopped;
            }
            on_step(completed_cycles.saturating_add(1), index);
            match step {
                PreparedStep::Send { target, bytes } => match inject(*target, bytes.clone()) {
                    Ok(()) => {}
                    Err(Error::NotRunning(_)) => return Outcome::Stopped,
                    Err(error) => return Outcome::Failed(error),
                },
                PreparedStep::Wait(duration) => {
                    tokio::select! {
                        _ = cancellation.cancelled() => return Outcome::Stopped,
                        _ = tokio::time::sleep(*duration) => {}
                    }
                }
            }
        }
        completed_cycles = completed_cycles.saturating_add(1);
        tokio::task::yield_now().await;
    }
    Outcome::Finished
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::time::Instant;

    use super::*;
    use crate::payload::PayloadFormat;
    use crate::workflow::WorkflowStep;

    fn steps() -> Vec<PreparedStep> {
        vec![
            PreparedStep::Send {
                target: Target::A,
                bytes: Bytes::from_static(b"ping"),
            },
            PreparedStep::Wait(Duration::from_secs(1)),
        ]
    }

    fn forever(name: &str, autostart: bool) -> Workflow {
        Workflow {
            name: name.into(),
            autostart,
            repeat: None,
            steps: vec![WorkflowStep::Wait { millis: 1000 }],
        }
    }

    fn status(profile: &str, workflow: &str) -> WorkflowStatus {
        WorkflowStatus {
            profile: profile.into(),
            workflow: workflow.into(),
            cycle: 1,
            step: 0,
        }
    }

    fn published(events: &mut broadcast::Receiver<Event>) -> Vec<WorkflowState> {
        std::iter::from_fn(|| events.try_recv().ok())
            .filter_map(|event| match event {
                Event::Workflow { state, .. } => Some(state),
                _ => None,
            })
            .collect()
    }

    #[tokio::test(start_paused = true)]
    async fn publishes_progress_from_start_to_finish() {
        let rift = Arc::new(Rift::new());
        let mut events = rift.subscribe();
        let workflows = Workflows::new(rift);
        let mut twice = forever("twice", false);
        twice.repeat = Some(2);
        twice.steps.push(WorkflowStep::Wait { millis: 1000 });
        workflows.start("gps", twice).unwrap();
        tokio::time::sleep(Duration::from_millis(2500)).await;
        let running = &workflows.running()[0];
        assert_eq!((running.cycle, running.step), (2, 0));
        tokio::time::sleep(Duration::from_secs(2)).await;
        let step = |cycle, step| WorkflowState::Step { cycle, step };
        assert_eq!(
            published(&mut events),
            vec![
                WorkflowState::Started,
                step(1, 0),
                step(1, 1),
                step(2, 0),
                step(2, 1),
                WorkflowState::Finished,
            ]
        );
    }

    #[tokio::test(start_paused = true)]
    async fn a_restart_is_never_followed_by_the_old_stop() {
        let rift = Arc::new(Rift::new());
        let mut events = rift.subscribe();
        let workflows = Workflows::new(rift);
        workflows.start("gps", forever("beat", false)).unwrap();
        tokio::time::sleep(Duration::from_millis(1)).await;
        workflows.stop("gps", "beat").unwrap();
        workflows.start("gps", forever("beat", false)).unwrap();
        tokio::time::sleep(Duration::from_millis(1)).await;
        let step = WorkflowState::Step { cycle: 1, step: 0 };
        assert_eq!(
            published(&mut events),
            vec![
                WorkflowState::Started,
                step.clone(),
                WorkflowState::Stopped,
                WorkflowState::Started,
                step,
            ]
        );
    }

    #[tokio::test(start_paused = true)]
    async fn finishes_after_the_repeat_count() {
        let started = Instant::now();
        let mut sent = Vec::new();
        let outcome = run_steps(
            &steps(),
            Some(3),
            &CancellationToken::new(),
            |_, _| {},
            |_, bytes| {
                sent.push(bytes);
                Ok(())
            },
        )
        .await;
        assert!(matches!(outcome, Outcome::Finished));
        assert_eq!(sent.len(), 3);
        assert_eq!(started.elapsed(), Duration::from_secs(3));
    }

    #[tokio::test(start_paused = true)]
    async fn forever_runs_until_cancelled() {
        let cancellation = CancellationToken::new();
        let canceller = cancellation.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(4500)).await;
            canceller.cancel();
        });
        let mut sent = 0;
        let outcome = run_steps(
            &steps(),
            None,
            &cancellation,
            |_, _| {},
            |_, _| {
                sent += 1;
                Ok(())
            },
        )
        .await;
        assert!(matches!(outcome, Outcome::Stopped));
        assert_eq!(sent, 5);
    }

    #[tokio::test(start_paused = true)]
    async fn not_running_stops_and_other_errors_fail() {
        let cancellation = CancellationToken::new();
        let stopped = run_steps(
            &steps(),
            None,
            &cancellation,
            |_, _| {},
            |_, _| Err(Error::NotRunning("gps".into())),
        )
        .await;
        assert!(matches!(stopped, Outcome::Stopped));
        let failed = run_steps(
            &steps(),
            None,
            &cancellation,
            |_, _| {},
            |_, _| Err(Error::Control("broken".into())),
        )
        .await;
        assert!(matches!(failed, Outcome::Failed(_)));
    }

    #[tokio::test(start_paused = true)]
    async fn registry_rejects_duplicates_and_stops() {
        let workflows = Workflows::new(Arc::new(Rift::new()));
        workflows.start("gps", forever("beat", false)).unwrap();
        assert!(matches!(
            workflows.start("gps", forever("beat", false)),
            Err(Error::WorkflowRunning(_))
        ));
        assert_eq!(workflows.running(), vec![status("gps", "beat")]);
        workflows.stop("gps", "beat").unwrap();
        assert!(workflows.running().is_empty());
        assert!(matches!(
            workflows.stop("gps", "beat"),
            Err(Error::WorkflowNotRunning(_))
        ));
    }

    #[tokio::test(start_paused = true)]
    async fn finished_workflows_leave_the_registry() {
        let workflows = Workflows::new(Arc::new(Rift::new()));
        let mut once = forever("once", false);
        once.repeat = Some(1);
        workflows.start("gps", once).unwrap();
        tokio::time::sleep(Duration::from_secs(2)).await;
        assert!(workflows.running().is_empty());
    }

    #[tokio::test(start_paused = true)]
    async fn send_to_a_stopped_profile_ends_the_workflow() {
        let workflows = Workflows::new(Arc::new(Rift::new()));
        let mut beat = forever("beat", false);
        beat.steps.insert(
            0,
            WorkflowStep::Send {
                target: Target::A,
                format: PayloadFormat::Text,
                payload: "ping".into(),
            },
        );
        workflows.start("gps", beat).unwrap();
        tokio::time::sleep(Duration::from_millis(1)).await;
        assert!(workflows.running().is_empty());
    }

    #[tokio::test(start_paused = true)]
    async fn autostarts_flagged_workflows_and_stops_by_profile() {
        let workflows = Workflows::new(Arc::new(Rift::new()));
        let profile = Profile {
            name: "gps".into(),
            a: "tcp://localhost:1".parse().unwrap(),
            b: "tcp://localhost:2".parse().unwrap(),
            workflows: vec![
                forever("auto", true),
                forever("manual", false),
                forever("", true),
            ],
        };
        assert_eq!(workflows.start_autostart(&profile).len(), 1);
        workflows.start("other", forever("beat", false)).unwrap();
        assert_eq!(
            workflows.running(),
            vec![status("gps", "auto"), status("other", "beat")]
        );
        workflows.stop_profile("gps");
        assert_eq!(workflows.running(), vec![status("other", "beat")]);
    }
}
