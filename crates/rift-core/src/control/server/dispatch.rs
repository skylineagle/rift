use serde_json::Value;

use super::Context;
use crate::control::protocol::{ControlRequest, HostStatus, WorkflowReference};
use crate::error::{Error, Result};
use crate::logging::LogRecord;
use crate::payload::{parse_payload, PayloadFormat};
use crate::side::Target;
use crate::workflow::Workflow;

pub(super) fn dispatch(context: &Context, request: ControlRequest) -> Result<Option<Value>> {
    match request {
        ControlRequest::Inject {
            profile,
            target,
            format,
            payload,
        } => inject(context, &profile, target, format, &payload).map(|()| None),
        ControlRequest::StartWorkflow { profile, workflow } => {
            start_workflow(context, &profile, workflow).map(|()| None)
        }
        ControlRequest::StopWorkflow { profile, workflow } => {
            context.workflows.stop(&profile, &workflow).map(|()| None)
        }
        ControlRequest::Status => status(context).map(Some),
    }
}

fn ensure_running(context: &Context, profile: &str) -> Result<()> {
    if context.rift.running().iter().any(|name| name == profile) {
        Ok(())
    } else {
        Err(Error::NotRunning(profile.to_string()))
    }
}

fn inject(
    context: &Context,
    profile: &str,
    target: Target,
    format: PayloadFormat,
    payload: &str,
) -> Result<()> {
    ensure_running(context, profile)?;
    let bytes = parse_payload(format, payload)?;
    let length = bytes.len();
    context.rift.inject(profile, target, bytes)?;
    context.rift.logger().log(
        LogRecord::info(
            "control.inject",
            format!("{profile} injected {length} bytes"),
        )
        .profile(profile)
        .field("target", target)
        .field("bytes", length),
    );
    Ok(())
}

fn start_workflow(context: &Context, profile: &str, reference: WorkflowReference) -> Result<()> {
    ensure_running(context, profile)?;
    let workflow = match reference {
        WorkflowReference::Name(name) => named_workflow(context, profile, &name)?,
        WorkflowReference::Inline(workflow) => workflow,
    };
    context.workflows.start(profile, workflow)
}

fn named_workflow(context: &Context, profile: &str, name: &str) -> Result<Workflow> {
    (context.profiles)(profile)
        .ok_or_else(|| Error::ProfileNotFound(profile.to_string()))?
        .workflows
        .into_iter()
        .find(|workflow| workflow.name == name)
        .ok_or_else(|| Error::WorkflowNotFound(name.to_string()))
}

fn status(context: &Context) -> Result<Value> {
    serde_json::to_value(HostStatus {
        kind: context.kind.clone(),
        pid: std::process::id(),
        profiles: context.rift.running(),
        workflows: context.workflows.running(),
    })
    .map_err(|error| Error::Control(error.to_string()))
}
