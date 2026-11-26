use std::net::TcpListener;
use std::sync::Arc;

use super::client::{send_in, status_all_in};
use super::*;
use crate::error::Error;
use crate::manager::Rift;
use crate::payload::PayloadFormat;
use crate::profile::Profile;
use crate::side::Target;
use crate::workflow::{Workflow, WorkflowStep};
use crate::workflow_runner::{WorkflowStatus, Workflows};

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn waiting(name: &str) -> Workflow {
    Workflow {
        name: name.into(),
        autostart: false,
        repeat: None,
        steps: vec![WorkflowStep::Wait { millis: 60_000 }],
    }
}

fn profile() -> Profile {
    Profile {
        name: "gps".into(),
        a: format!("tcp-server://127.0.0.1:{}", free_port())
            .parse()
            .unwrap(),
        b: format!("tcp-server://127.0.0.1:{}", free_port())
            .parse()
            .unwrap(),
        workflows: vec![waiting("heartbeat")],
    }
}

fn inject(profile: &str, payload: &str) -> ControlRequest {
    ControlRequest::Inject {
        profile: profile.into(),
        target: Target::Both,
        format: PayloadFormat::Hex,
        payload: payload.into(),
    }
}

fn start(workflow: WorkflowReference) -> ControlRequest {
    ControlRequest::StartWorkflow {
        profile: "gps".into(),
        workflow,
    }
}

fn failure_message(result: crate::error::Result<ControlResponse>) -> String {
    match result {
        Err(Error::Control(message)) => message,
        other => panic!("expected a control error, got {other:?}"),
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn serves_requests_end_to_end() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().to_path_buf();
    assert_eq!(
        failure_message(send_in(&path, ControlRequest::Status)),
        "no running Rift instance found"
    );

    let rift = Arc::new(Rift::new());
    let workflows = Arc::new(Workflows::new(rift.clone()));
    let stored = profile();
    rift.start(stored.clone()).unwrap();
    let server = ControlServer::start_in(
        &path,
        "cli",
        rift.clone(),
        workflows.clone(),
        Arc::new(move |name| (name == stored.name).then(|| stored.clone())),
    )
    .unwrap();

    let client_path = path.clone();
    tokio::task::spawn_blocking(move || {
        let path = client_path;
        assert!(send_in(&path, inject("gps", "0102")).unwrap().ok);
        assert!(failure_message(send_in(&path, inject("gps", "zz"))).contains("invalid payload"));
        assert_eq!(
            failure_message(send_in(&path, inject("lidar", "01"))),
            "profile `lidar` is not running in any Rift instance"
        );
        let named = start(WorkflowReference::Name("heartbeat".into()));
        assert!(send_in(&path, named.clone()).unwrap().ok);
        assert!(failure_message(send_in(&path, named)).contains("already running"));
        assert!(failure_message(send_in(
            &path,
            start(WorkflowReference::Name("missing".into()))
        ))
        .contains("not found"));
        assert!(
            send_in(&path, start(WorkflowReference::Inline(waiting("inline"))))
                .unwrap()
                .ok
        );
        let stop = ControlRequest::StopWorkflow {
            profile: "gps".into(),
            workflow: "inline".into(),
        };
        assert!(send_in(&path, stop.clone()).unwrap().ok);
        assert!(failure_message(send_in(&path, stop)).contains("workflow `inline`"));
        let statuses = status_all_in(&path).unwrap();
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].kind, "cli");
        assert_eq!(statuses[0].profiles, vec!["gps".to_string()]);
        assert_eq!(
            statuses[0].workflows,
            vec![WorkflowStatus {
                profile: "gps".into(),
                workflow: "heartbeat".into(),
                cycle: 1,
                step: 0,
            }]
        );
    })
    .await
    .unwrap();

    drop(server);
    assert_eq!(std::fs::read_dir(&path).unwrap().count(), 0);
    rift.stop_all().await;
}

#[test]
fn deletes_stale_host_files() {
    let directory = tempfile::tempdir().unwrap();
    let stale = directory.path().join("1.json");
    std::fs::write(
        &stale,
        format!(
            r#"{{"pid":1,"port":{},"token":"x","kind":"cli"}}"#,
            free_port()
        ),
    )
    .unwrap();
    assert_eq!(
        failure_message(send_in(directory.path(), ControlRequest::Status)),
        "no running Rift instance found"
    );
    assert!(!stale.exists());
}
