use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Error;
use crate::payload::PayloadFormat;
use crate::side::Target;
use crate::workflow::Workflow;
use crate::workflow_runner::WorkflowStatus;

pub(super) const MAX_REQUEST_BYTES: u64 = 64 * 1024;
pub(super) const MAX_RESPONSE_BYTES: u64 = 1024 * 1024;
pub(super) const REQUEST_TOO_LARGE: &str = "request exceeds 64 KiB";
pub(super) const INVALID_TOKEN: &str = "invalid token";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ControlRequest {
    Inject {
        profile: String,
        target: Target,
        format: PayloadFormat,
        payload: String,
    },
    StartWorkflow {
        profile: String,
        workflow: WorkflowReference,
    },
    StopWorkflow {
        profile: String,
        workflow: String,
    },
    Status,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkflowReference {
    Name(String),
    Inline(Workflow),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ControlResponse {
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub not_running: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostStatus {
    pub kind: String,
    pub pid: u32,
    pub profiles: Vec<String>,
    pub workflows: Vec<WorkflowStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct Envelope {
    pub token: String,
    pub request: ControlRequest,
}

#[derive(Debug, Deserialize)]
pub(super) struct Credentials {
    pub token: String,
}

impl ControlResponse {
    pub(super) fn success(data: Option<Value>) -> Self {
        Self {
            ok: true,
            data,
            error: None,
            not_running: None,
        }
    }

    pub(super) fn failure(error: &Error) -> Self {
        Self::rejection(
            error.to_string(),
            matches!(error, Error::NotRunning(_) | Error::WorkflowNotRunning(_)),
        )
    }

    pub(super) fn rejection(message: String, not_running: bool) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(message),
            not_running: Some(not_running),
        }
    }

    pub(super) fn is_token_rejection(&self) -> bool {
        !self.ok && self.error.as_deref() == Some(INVALID_TOKEN)
    }

    pub(super) fn is_not_running(&self) -> bool {
        self.not_running == Some(true)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn requests_use_the_wire_shape() {
        let named = ControlRequest::StartWorkflow {
            profile: "gps".into(),
            workflow: WorkflowReference::Name("heartbeat".into()),
        };
        assert_eq!(
            serde_json::to_value(&named).unwrap(),
            json!({"type":"start-workflow","profile":"gps","workflow":{"name":"heartbeat"}})
        );
        let inject: ControlRequest = serde_json::from_value(
            json!({"type":"inject","profile":"gps","target":"Both","format":"text","payload":"hi"}),
        )
        .unwrap();
        assert!(matches!(inject, ControlRequest::Inject { .. }));
        assert_eq!(
            serde_json::to_value(ControlRequest::Status).unwrap(),
            json!({"type":"status"})
        );
    }

    #[test]
    fn responses_omit_absent_members() {
        assert_eq!(
            serde_json::to_value(ControlResponse::success(None)).unwrap(),
            json!({"ok":true})
        );
        assert_eq!(
            serde_json::to_value(ControlResponse::failure(&Error::NotRunning("gps".into())))
                .unwrap(),
            json!({"ok":false,"error":"profile `gps` is not running","not_running":true})
        );
    }
}
