use std::time::Duration;

use bytes::Bytes;
use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::payload::{parse_payload, PayloadFormat};
use crate::side::Target;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workflow {
    pub name: String,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat: Option<u32>,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum WorkflowStep {
    Send {
        target: Target,
        format: PayloadFormat,
        payload: String,
    },
    Wait {
        millis: u64,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PreparedStep {
    Send { target: Target, bytes: Bytes },
    Wait(Duration),
}

impl Workflow {
    pub fn validate(&self) -> Result<()> {
        self.prepare().map(|_| ())
    }

    pub(crate) fn prepare(&self) -> Result<Vec<PreparedStep>> {
        if self.name.trim().is_empty() {
            return Err(invalid("name cannot be empty"));
        }
        if self.steps.is_empty() {
            return Err(invalid("at least one step is required"));
        }
        if self.repeat.is_none() && !self.has_pause() {
            return Err(invalid(
                "a workflow looping forever needs a wait longer than 0 ms",
            ));
        }
        self.steps.iter().map(WorkflowStep::prepare).collect()
    }

    fn has_pause(&self) -> bool {
        self.steps
            .iter()
            .any(|step| matches!(step, WorkflowStep::Wait { millis } if *millis > 0))
    }
}

impl WorkflowStep {
    fn prepare(&self) -> Result<PreparedStep> {
        Ok(match self {
            WorkflowStep::Send {
                target,
                format,
                payload,
            } => PreparedStep::Send {
                target: *target,
                bytes: parse_payload(*format, payload)?.into(),
            },
            WorkflowStep::Wait { millis } => PreparedStep::Wait(Duration::from_millis(*millis)),
        })
    }
}

fn invalid(message: &str) -> Error {
    Error::InvalidWorkflow(message.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn send(payload: &str) -> WorkflowStep {
        WorkflowStep::Send {
            target: Target::Both,
            format: PayloadFormat::Hex,
            payload: payload.into(),
        }
    }

    fn workflow(repeat: Option<u32>, steps: Vec<WorkflowStep>) -> Workflow {
        Workflow {
            name: "heartbeat".into(),
            autostart: false,
            repeat,
            steps,
        }
    }

    #[test]
    fn rejects_empty_name_and_steps() {
        let mut unnamed = workflow(Some(1), vec![send("01")]);
        unnamed.name = " ".into();
        assert!(unnamed.validate().is_err());
        assert!(workflow(Some(1), vec![]).validate().is_err());
    }

    #[test]
    fn rejects_forever_without_a_positive_wait() {
        assert!(workflow(None, vec![send("01")]).validate().is_err());
        assert!(
            workflow(None, vec![send("01"), WorkflowStep::Wait { millis: 0 }])
                .validate()
                .is_err()
        );
        assert!(
            workflow(None, vec![send("01"), WorkflowStep::Wait { millis: 1 }])
                .validate()
                .is_ok()
        );
        assert!(workflow(Some(3), vec![send("01")]).validate().is_ok());
    }

    #[test]
    fn rejects_bad_payloads() {
        assert!(matches!(
            workflow(Some(1), vec![send("zz")]).validate(),
            Err(Error::InvalidPayload(_))
        ));
    }

    #[test]
    fn reads_the_toml_shape() {
        let parsed: Workflow = toml::from_str(
            r#"
name = "heartbeat"
steps = [
  { action = "send", target = "Both", format = "text", payload = "PING\\r\\n" },
  { action = "wait", millis = 1000 },
]
"#,
        )
        .unwrap();
        assert!(!parsed.autostart);
        assert_eq!(parsed.repeat, None);
        assert_eq!(
            parsed.prepare().unwrap(),
            vec![
                PreparedStep::Send {
                    target: Target::Both,
                    bytes: Bytes::from_static(b"PING\r\n"),
                },
                PreparedStep::Wait(Duration::from_secs(1)),
            ]
        );
    }
}
