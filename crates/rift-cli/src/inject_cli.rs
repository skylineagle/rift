use std::path::Path;
use std::time::Duration;

use anyhow::{Context, Result};
use rift_core::control::{send, ControlRequest, WorkflowReference};
use rift_core::{PayloadFormat, Target, Workflow, WorkflowStep};

use crate::arguments::InjectArguments;

const REPEATING_WORKFLOW_NAME: &str = "cli-inject";

pub fn inject(arguments: InjectArguments) -> Result<()> {
    let payload = resolve_payload(arguments.format, arguments.payload.join(" "))?;
    let profile = arguments.profile;
    match arguments.every {
        None => {
            send(ControlRequest::Inject {
                profile: profile.clone(),
                target: arguments.target,
                format: arguments.format,
                payload,
            })?;
            println!("injected into {profile}");
        }
        Some(every) => {
            let workflow = repeating_workflow(
                arguments.target,
                arguments.format,
                payload,
                every,
                arguments.count,
            );
            send(ControlRequest::StartWorkflow {
                profile: profile.clone(),
                workflow: WorkflowReference::Inline(workflow),
            })?;
            println!(
                "started {REPEATING_WORKFLOW_NAME} on {profile}, stop it with `rift workflow stop {profile} {REPEATING_WORKFLOW_NAME}`"
            );
        }
    }
    Ok(())
}

fn resolve_payload(format: PayloadFormat, payload: String) -> Result<String> {
    if format != PayloadFormat::File {
        return Ok(payload);
    }
    let path = Path::new(&payload)
        .canonicalize()
        .with_context(|| format!("cannot read payload file `{payload}`"))?;
    path.into_os_string()
        .into_string()
        .ok()
        .context("payload file path is not valid UTF-8")
}

fn repeating_workflow(
    target: Target,
    format: PayloadFormat,
    payload: String,
    every: Duration,
    count: Option<u32>,
) -> Workflow {
    Workflow {
        name: REPEATING_WORKFLOW_NAME.to_string(),
        autostart: false,
        repeat: count,
        steps: vec![
            WorkflowStep::Send {
                target,
                format,
                payload,
            },
            WorkflowStep::Wait {
                millis: u64::try_from(every.as_millis()).unwrap_or(u64::MAX),
            },
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_a_send_then_wait_workflow() {
        let workflow = repeating_workflow(
            Target::Both,
            PayloadFormat::Text,
            "ping".into(),
            Duration::from_millis(200),
            Some(3),
        );
        assert_eq!(workflow.name, REPEATING_WORKFLOW_NAME);
        assert!(!workflow.autostart);
        assert_eq!(workflow.repeat, Some(3));
        assert_eq!(
            workflow.steps,
            vec![
                WorkflowStep::Send {
                    target: Target::Both,
                    format: PayloadFormat::Text,
                    payload: "ping".into(),
                },
                WorkflowStep::Wait { millis: 200 },
            ]
        );
        assert!(workflow.validate().is_ok());
    }

    #[test]
    fn loops_forever_without_a_count() {
        let workflow = repeating_workflow(
            Target::A,
            PayloadFormat::Hex,
            "01".into(),
            Duration::from_secs(1),
            None,
        );
        assert_eq!(workflow.repeat, None);
        assert!(workflow.validate().is_ok());
    }

    #[test]
    fn makes_file_payloads_absolute_and_leaves_others_alone() {
        let resolved = resolve_payload(PayloadFormat::File, "Cargo.toml".into()).unwrap();
        assert!(Path::new(&resolved).is_absolute());
        assert!(resolve_payload(PayloadFormat::File, "missing.bin".into()).is_err());
        assert_eq!(
            resolve_payload(PayloadFormat::Text, "Cargo.toml".into()).unwrap(),
            "Cargo.toml"
        );
    }
}
