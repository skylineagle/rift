use chrono::{DateTime, Local, Utc};
use rift_core::format::{escaped_ascii, hex_dump_line};
use rift_core::{Event, Origin, WorkflowState};

use crate::arguments::LogFormat;

pub fn render(event: &Event, format: LogFormat, quiet: bool) -> Option<String> {
    if quiet && is_noisy(event) {
        return None;
    }
    if let LogFormat::Json = format {
        return serde_json::to_string(event).ok();
    }
    match event {
        Event::Data {
            profile,
            timestamp,
            source,
            target,
            origin,
            bytes,
            delivered,
            undelivered_reason,
        } => {
            let direction = match origin {
                Origin::Received => format!("{source} received"),
                Origin::Forwarded => format!("{source}→{target}"),
                Origin::Injected => format!("inject→{target}"),
            };
            let body = match format {
                LogFormat::Text => format!("{}B \"{}\"", bytes.len(), escaped_ascii(bytes)),
                _ => hex_dump_line(bytes),
            };
            let dropped = if *delivered {
                String::new()
            } else {
                undelivered_reason.as_ref().map_or_else(
                    || " [dropped]".to_string(),
                    |reason| format!(" [not delivered: Side {target} is {reason}]"),
                )
            };
            Some(format!(
                "{} {profile} {direction} {body}{dropped}",
                clock(timestamp)
            ))
        }
        Event::Status {
            profile,
            timestamp,
            side,
            state,
        } => Some(format!("{} {profile} {side} {state}", clock(timestamp))),
        Event::Dropped {
            profile,
            timestamp,
            side,
            peer,
            chunks,
        } => {
            let peer = peer
                .as_ref()
                .map_or_else(String::new, |peer| format!(" {peer}"));
            Some(format!(
                "{} {profile} {side}{peer} couldn't keep up, dropped {chunks} chunks",
                clock(timestamp)
            ))
        }
        Event::Workflow {
            profile,
            timestamp,
            workflow,
            state,
        } => Some(format!(
            "{} {profile} workflow {workflow} {}",
            clock(timestamp),
            describe_workflow(state)
        )),
    }
}

fn is_noisy(event: &Event) -> bool {
    matches!(
        event,
        Event::Data { .. }
            | Event::Workflow {
                state: WorkflowState::Step { .. },
                ..
            }
    )
}

fn describe_workflow(state: &WorkflowState) -> String {
    match state {
        WorkflowState::Started => "started".to_string(),
        WorkflowState::Step { cycle, step } => format!("step {} (cycle {cycle})", step + 1),
        WorkflowState::Finished => "finished".to_string(),
        WorkflowState::Stopped => "stopped".to_string(),
        WorkflowState::Failed { message } => format!("failed: {message}"),
    }
}

fn clock(timestamp: &DateTime<Utc>) -> String {
    timestamp
        .with_timezone(&Local)
        .format("%H:%M:%S%.3f")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rift_core::Side;

    #[test]
    fn distinguishes_receive_forward_and_injection_in_text_and_json() {
        for (origin, label) in [
            (Origin::Received, "A received"),
            (Origin::Forwarded, "A→B"),
            (Origin::Injected, "inject→B"),
        ] {
            let event = Event::data("test", Side::A, Side::B, origin, b"hello", true);
            assert!(render(&event, LogFormat::Text, false)
                .unwrap()
                .contains(label));
            let json = render(&event, LogFormat::Json, false).unwrap();
            assert_eq!(serde_json::from_str::<Event>(&json).unwrap(), event);
            assert!(render(&event, LogFormat::Text, true).is_none());
            assert!(render(&event, LogFormat::Json, true).is_none());
        }
    }

    #[test]
    fn unavailable_listener_reason_is_visible_without_an_error_status() {
        let mut event = Event::data("test", Side::B, Side::A, Origin::Injected, b"hello", false);
        if let Event::Data {
            undelivered_reason, ..
        } = &mut event
        {
            *undelivered_reason = Some("listening but has no connected clients".to_string());
        }
        assert!(render(&event, LogFormat::Text, false)
            .unwrap()
            .contains("Side A is listening but has no connected clients"));
    }

    #[test]
    fn paused_injections_explain_both_targets_without_error_labels() {
        for side in [Side::A, Side::B] {
            let mut event = Event::data(
                "test",
                side.opposite(),
                side,
                Origin::Injected,
                b"hello",
                false,
            );
            if let Event::Data {
                undelivered_reason, ..
            } = &mut event
            {
                *undelivered_reason = Some("paused".to_string());
            }
            for format in [LogFormat::Text, LogFormat::Hex] {
                let text = render(&event, format, false).unwrap();
                assert!(text.contains(&format!("not delivered: Side {side} is paused")));
                assert!(!text.to_lowercase().contains("error"));
            }
            let json = render(&event, LogFormat::Json, false).unwrap();
            assert_eq!(serde_json::from_str::<Event>(&json).unwrap(), event);
        }
    }

    #[test]
    fn quiet_hides_only_workflow_steps() {
        let step = Event::workflow(
            "gps",
            "heartbeat",
            WorkflowState::Step { cycle: 3, step: 1 },
        );
        let started = Event::workflow("gps", "heartbeat", WorkflowState::Started);
        for format in [LogFormat::Text, LogFormat::Hex, LogFormat::Json] {
            assert!(render(&step, format, true).is_none());
            assert!(render(&started, format, true).is_some());
        }
        assert!(render(&step, LogFormat::Text, false)
            .unwrap()
            .ends_with("gps workflow heartbeat step 2 (cycle 3)"));
        let json = render(&step, LogFormat::Json, false).unwrap();
        assert!(json.contains(r#""state":{"state":"step","cycle":3,"step":1}"#));
        assert_eq!(serde_json::from_str::<Event>(&json).unwrap(), step);
    }

    #[test]
    fn old_data_events_still_deserialize() {
        let event = Event::data("test", Side::A, Side::B, Origin::Forwarded, b"hello", false);
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"origin\":\"forwarded\""));
        assert_eq!(serde_json::from_str::<Event>(&json).unwrap(), event);
    }
}
