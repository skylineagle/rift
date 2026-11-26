use anyhow::Result;
use rift_core::control::{send, status_all, ControlRequest, HostStatus, WorkflowReference};
use rift_core::{Profile, ProfileStore};

use crate::arguments::{ConfigArguments, WorkflowAction};
use crate::config_path::resolve;

pub fn workflow(action: WorkflowAction) -> Result<()> {
    match action {
        WorkflowAction::List { config } => list(&config),
        WorkflowAction::Start { profile, name } => start(profile, name),
        WorkflowAction::Stop { profile, name } => stop(profile, name),
        WorkflowAction::Status => status(),
    }
}

fn list(config: &ConfigArguments) -> Result<()> {
    let store = ProfileStore::load_or_default(&resolve(config)?)?;
    for line in store.list().iter().flat_map(describe_workflows) {
        println!("{line}");
    }
    Ok(())
}

fn start(profile: String, name: String) -> Result<()> {
    send(ControlRequest::StartWorkflow {
        profile: profile.clone(),
        workflow: WorkflowReference::Name(name.clone()),
    })?;
    println!("started {name} on {profile}");
    Ok(())
}

fn stop(profile: String, name: String) -> Result<()> {
    send(ControlRequest::StopWorkflow {
        profile: profile.clone(),
        workflow: name.clone(),
    })?;
    println!("stopped {name} on {profile}");
    Ok(())
}

fn status() -> Result<()> {
    let hosts = status_all()?;
    if hosts.is_empty() {
        println!("no running Rift instance found");
    }
    for host in &hosts {
        println!("{}", describe_host(host));
    }
    Ok(())
}

fn describe_workflows(profile: &Profile) -> impl Iterator<Item = String> + '_ {
    profile.workflows.iter().map(|workflow| {
        let repeat = workflow
            .repeat
            .map_or_else(|| "forever".to_string(), |cycles| cycles.to_string());
        format!(
            "{}  {}  autostart={}  repeat={repeat}  steps={}",
            profile.name,
            workflow.name,
            workflow.autostart,
            workflow.steps.len()
        )
    })
}

fn describe_host(host: &HostStatus) -> String {
    let workflows: Vec<String> = host
        .workflows
        .iter()
        .map(|status| format!("{}/{}", status.profile, status.workflow))
        .collect();
    format!(
        "{} pid={}\n  profiles: {}\n  workflows: {}",
        host.kind,
        host.pid,
        join_or_dash(&host.profiles),
        join_or_dash(&workflows)
    )
}

fn join_or_dash(names: &[String]) -> String {
    if names.is_empty() {
        "-".to_string()
    } else {
        names.join(", ")
    }
}

#[cfg(test)]
mod tests {
    use rift_core::{WorkflowStatus, WorkflowStep};

    use super::*;

    #[test]
    fn describes_configured_workflows() {
        let profile = Profile {
            name: "gps".into(),
            a: "tcp://localhost:1".parse().unwrap(),
            b: "tcp://localhost:2".parse().unwrap(),
            workflows: vec![rift_core::Workflow {
                name: "beat".into(),
                autostart: true,
                repeat: None,
                steps: vec![WorkflowStep::Wait { millis: 1 }],
            }],
        };
        assert_eq!(
            describe_workflows(&profile).collect::<Vec<_>>(),
            ["gps  beat  autostart=true  repeat=forever  steps=1"]
        );
    }

    #[test]
    fn describes_a_host_with_and_without_workflows() {
        let mut host = HostStatus {
            kind: "cli".into(),
            pid: 7,
            profiles: vec!["gps".into()],
            workflows: Vec::new(),
        };
        assert_eq!(
            describe_host(&host),
            "cli pid=7\n  profiles: gps\n  workflows: -"
        );
        host.workflows.push(WorkflowStatus {
            profile: "gps".into(),
            workflow: "beat".into(),
            cycle: 1,
            step: 0,
        });
        assert!(describe_host(&host).ends_with("workflows: gps/beat"));
    }
}
