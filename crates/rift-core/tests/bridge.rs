use std::net::{TcpListener, UdpSocket as StdUdpSocket};
use std::time::Duration;

use rift_core::{ConnectionState, Event, Origin, Profile, Rift, Side, Target};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::broadcast::Receiver;
use tokio::time::timeout;

const WAIT: Duration = Duration::from_secs(5);

fn free_tcp_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

fn free_udp_port() -> u16 {
    StdUdpSocket::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

async fn wait_for(events: &mut Receiver<Event>, matches: impl Fn(&Event) -> bool) -> Event {
    timeout(WAIT, async {
        loop {
            let event = events.recv().await.unwrap();
            if matches(&event) {
                return event;
            }
        }
    })
    .await
    .expect("timed out waiting for event")
}

async fn receive(socket: &UdpSocket) -> Vec<u8> {
    let mut buffer = [0u8; 64];
    let count = timeout(WAIT, socket.recv(&mut buffer))
        .await
        .unwrap()
        .unwrap();
    buffer[..count].to_vec()
}

async fn read_exact(stream: &mut TcpStream, length: usize) -> Vec<u8> {
    let mut buffer = vec![0u8; length];
    timeout(WAIT, stream.read_exact(&mut buffer))
        .await
        .unwrap()
        .unwrap();
    buffer
}

#[tokio::test]
async fn bridges_tcp_server_and_udp_server_both_ways() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let rift = Rift::new();
    let mut events = rift.subscribe();
    rift.start(Profile {
        name: "test".into(),
        a: format!("tcp-server://127.0.0.1:{tcp_port}")
            .parse()
            .unwrap(),
        b: format!("udp-server://127.0.0.1:{udp_port}")
            .parse()
            .unwrap(),
    })
    .unwrap();

    for side in [Side::A, Side::B] {
        wait_for(&mut events, |event| {
            matches!(event, Event::Status { side: s, state: ConnectionState::Listening, .. } if *s == side)
        })
        .await;
    }

    let mut tcp_client = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;

    let udp_peer = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    udp_peer.connect(("127.0.0.1", udp_port)).await.unwrap();
    udp_peer.send(b"ping").await.unwrap();
    assert_eq!(read_exact(&mut tcp_client, 4).await, b"ping");
    let forwarded = wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                origin: Origin::Forwarded,
                ..
            }
        )
    })
    .await;
    assert!(matches!(
        forwarded,
        Event::Data {
            source: Side::B,
            target: Side::A,
            delivered: true,
            ..
        }
    ));

    tcp_client.write_all(b"pong").await.unwrap();
    assert_eq!(receive(&udp_peer).await, b"pong");

    rift.inject("test", Target::Both, b"xy".to_vec()).unwrap();
    assert_eq!(read_exact(&mut tcp_client, 2).await, b"xy");
    assert_eq!(receive(&udp_peer).await, b"xy");
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                origin: Origin::Injected,
                ..
            }
        )
    })
    .await;

    assert_eq!(rift.running(), vec!["test".to_string()]);
    rift.stop("test").await.unwrap();
    assert!(rift.running().is_empty());
}

#[tokio::test]
async fn logs_received_data_when_opposite_side_has_no_peers() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let rift = Rift::new();
    let mut events = rift.subscribe();
    rift.start(Profile {
        name: "lonely".into(),
        a: format!("tcp-server://127.0.0.1:{tcp_port}")
            .parse()
            .unwrap(),
        b: format!("udp-server://127.0.0.1:{udp_port}")
            .parse()
            .unwrap(),
    })
    .unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Listening,
                ..
            }
        )
    })
    .await;

    let mut tcp_client = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    tcp_client.write_all(b"lost").await.unwrap();
    let received = wait_for(&mut events, |event| matches!(event, Event::Data { .. })).await;
    assert!(matches!(
        received,
        Event::Data {
            origin: Origin::Received,
            delivered: true,
            ..
        }
    ));
    rift.stop_all().await;
}

async fn start_pair(name: &str, a: String, b: String) -> (Rift, Receiver<Event>) {
    let rift = Rift::new();
    let events = rift.subscribe();
    rift.start(Profile {
        name: name.into(),
        a: a.parse().unwrap(),
        b: b.parse().unwrap(),
    })
    .unwrap();
    (rift, events)
}

async fn wait_listening(events: &mut Receiver<Event>, side: Side) {
    wait_for(events, |event| {
        matches!(event, Event::Status { side: s, state: ConnectionState::Listening, .. } if *s == side)
    })
    .await;
}

#[tokio::test]
async fn tcp_server_rejects_clients_over_max_clients() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let (rift, mut events) = start_pair(
        "capped",
        format!("tcp-server://127.0.0.1:{tcp_port}?max_clients=1"),
        format!("udp-server://127.0.0.1:{udp_port}"),
    )
    .await;
    wait_listening(&mut events, Side::A).await;

    let _first = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;

    let mut second = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Error { .. },
                ..
            }
        )
    })
    .await;
    let mut buffer = [0u8; 1];
    let read = timeout(WAIT, second.read(&mut buffer)).await.unwrap();
    assert!(matches!(read, Ok(0) | Err(_)));
    rift.stop_all().await;
}

#[tokio::test]
async fn udp_server_reply_to_last_targets_latest_peer() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let (rift, mut events) = start_pair(
        "last",
        format!("tcp-server://127.0.0.1:{tcp_port}"),
        format!("udp-server://127.0.0.1:{udp_port}?reply_to=last"),
    )
    .await;
    wait_listening(&mut events, Side::B).await;

    let first = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    first.connect(("127.0.0.1", udp_port)).await.unwrap();
    let second = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    second.connect(("127.0.0.1", udp_port)).await.unwrap();
    first.send(b"one").await.unwrap();
    second.send(b"two").await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                source: Side::B,
                ..
            }
        )
    })
    .await;
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                source: Side::B,
                ..
            }
        )
    })
    .await;

    rift.inject("last", Target::B, b"hi".to_vec()).unwrap();
    assert_eq!(receive(&second).await, b"hi");
    let mut buffer = [0u8; 8];
    let silent = timeout(Duration::from_millis(300), first.recv(&mut buffer)).await;
    assert!(silent.is_err());
    rift.stop_all().await;
}

fn side_status(rift: &Rift, side: Side) -> ConnectionState {
    let status = rift.status().remove(0);
    match side {
        Side::A => status.a.state,
        Side::B => status.b.state,
    }
}

#[tokio::test]
async fn disabled_side_is_not_opened_and_incoming_data_is_received() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let (rift, mut events) = start_pair(
        "half",
        format!("tcp-server://127.0.0.1:{tcp_port}"),
        format!("udp-server://127.0.0.1:{udp_port}?enabled=false"),
    )
    .await;
    wait_listening(&mut events, Side::A).await;
    assert_eq!(side_status(&rift, Side::B), ConnectionState::Disabled);
    assert!(StdUdpSocket::bind(("127.0.0.1", udp_port)).is_ok());

    let mut tcp_client = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    tcp_client.write_all(b"nowhere").await.unwrap();
    let received = wait_for(&mut events, |event| matches!(event, Event::Data { .. })).await;
    assert!(matches!(
        received,
        Event::Data {
            source: Side::A,
            target: Side::B,
            origin: Origin::Received,
            delivered: true,
            ..
        }
    ));
    rift.inject("half", Target::B, b"x".to_vec()).unwrap();
    let injected = wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                origin: Origin::Injected,
                ..
            }
        )
    })
    .await;
    assert!(matches!(
        injected,
        Event::Data {
            delivered: false,
            ..
        }
    ));
    rift.stop_all().await;
}

#[tokio::test]
async fn toggling_a_side_at_runtime_leaves_the_other_untouched() {
    let tcp_port = free_tcp_port();
    let udp_port = free_udp_port();
    let (rift, mut events) = start_pair(
        "toggle",
        format!("tcp-server://127.0.0.1:{tcp_port}"),
        format!("udp-server://127.0.0.1:{udp_port}"),
    )
    .await;
    wait_listening(&mut events, Side::A).await;
    wait_listening(&mut events, Side::B).await;

    rift.set_side_enabled("toggle", Side::B, false)
        .await
        .unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::B,
                state: ConnectionState::Disabled,
                ..
            }
        )
    })
    .await;
    assert_eq!(side_status(&rift, Side::A), ConnectionState::Listening);
    assert!(StdUdpSocket::bind(("127.0.0.1", udp_port)).is_ok());
    assert!(TcpStream::connect(("127.0.0.1", tcp_port)).await.is_ok());

    rift.set_side_enabled("toggle", Side::B, true)
        .await
        .unwrap();
    wait_listening(&mut events, Side::B).await;
    assert_eq!(side_status(&rift, Side::B), ConnectionState::Listening);

    let mut tcp_client = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    let udp_peer = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    udp_peer
        .send_to(b"hello", ("127.0.0.1", udp_port))
        .await
        .unwrap();
    assert_eq!(read_exact(&mut tcp_client, 5).await, b"hello");

    assert!(rift
        .set_side_enabled("missing", Side::A, false)
        .await
        .is_err());
    rift.stop_all().await;
}

#[tokio::test]
async fn each_side_can_start_alone_and_reconfigure_without_disconnecting_its_peer() {
    let a_port = free_tcp_port();
    let b_port = free_udp_port();
    let next_b_port = free_udp_port();
    let (rift, mut events) = start_pair(
        "independent",
        format!("tcp-server://127.0.0.1:{a_port}?enabled=false"),
        format!("udp-server://127.0.0.1:{b_port}?enabled=false"),
    )
    .await;
    assert!(TcpListener::bind(("127.0.0.1", a_port)).is_ok());
    assert!(StdUdpSocket::bind(("127.0.0.1", b_port)).is_ok());

    rift.set_side_enabled("independent", Side::B, true)
        .await
        .unwrap();
    wait_listening(&mut events, Side::B).await;
    assert_eq!(side_status(&rift, Side::A), ConnectionState::Disabled);
    let udp = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    udp.send_to(b"alone", ("127.0.0.1", b_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                source: Side::B,
                origin: Origin::Received,
                delivered: true,
                ..
            }
        )
    })
    .await;
    rift.inject("independent", Target::B, b"reply".to_vec())
        .unwrap();
    assert_eq!(receive(&udp).await, b"reply");

    rift.set_side_enabled("independent", Side::A, true)
        .await
        .unwrap();
    wait_listening(&mut events, Side::A).await;
    let mut tcp = TcpStream::connect(("127.0.0.1", a_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;
    tcp.write_all(b"both").await.unwrap();
    assert_eq!(receive(&udp).await, b"both");

    rift.configure_side(
        "independent",
        Side::B,
        format!("udp-server://127.0.0.1:{next_b_port}")
            .parse()
            .unwrap(),
    )
    .await
    .unwrap();
    wait_listening(&mut events, Side::B).await;
    assert!(StdUdpSocket::bind(("127.0.0.1", b_port)).is_ok());
    udp.send_to(b"new", ("127.0.0.1", next_b_port))
        .await
        .unwrap();
    assert_eq!(read_exact(&mut tcp, 3).await, b"new");

    rift.set_side_enabled("independent", Side::B, false)
        .await
        .unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::B,
                state: ConnectionState::Disabled,
                ..
            }
        )
    })
    .await;
    tcp.write_all(b"a-alone").await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Data {
                source: Side::A,
                origin: Origin::Received,
                delivered: true,
                ..
            }
        )
    })
    .await;
    rift.inject("independent", Target::A, b"still-open".to_vec())
        .unwrap();
    assert_eq!(read_exact(&mut tcp, 10).await, b"still-open");
    rift.set_side_enabled("independent", Side::A, false)
        .await
        .unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Disabled,
                ..
            }
        )
    })
    .await;
    assert!(TcpListener::bind(("127.0.0.1", a_port)).is_ok());
    assert!(StdUdpSocket::bind(("127.0.0.1", next_b_port)).is_ok());
    rift.stop_all().await;
}

async fn assert_receive_only(events: &mut Receiver<Event>, side: Side, bytes: &[u8]) {
    let received = wait_for(events, |event| matches!(event, Event::Data { .. })).await;
    assert!(matches!(received, Event::Data {
        source, origin: Origin::Received, delivered: true, bytes: ref payload, ..
    } if source == side && payload == bytes));
    while let Ok(Ok(event)) = timeout(Duration::from_millis(100), events.recv()).await {
        assert!(
            !matches!(
                event,
                Event::Data { .. }
                    | Event::Status {
                        state: ConnectionState::Error { .. },
                        ..
                    }
            ),
            "unexpected event: {event:?}"
        );
    }
}

#[tokio::test]
async fn receives_without_errors_when_tcp_destination_has_no_clients() {
    let a_port = free_tcp_port();
    let b_port = free_tcp_port();
    let (rift, mut events) = start_pair(
        "no-clients",
        format!("tcp-server://127.0.0.1:{a_port}"),
        format!("tcp-server://127.0.0.1:{b_port}"),
    )
    .await;
    wait_listening(&mut events, Side::A).await;
    wait_listening(&mut events, Side::B).await;
    let mut client = TcpStream::connect(("127.0.0.1", a_port)).await.unwrap();
    client.write_all(b"received").await.unwrap();
    assert_receive_only(&mut events, Side::A, b"received").await;
    rift.stop_all().await;
}

#[tokio::test]
async fn receives_without_errors_when_destination_is_disabled_or_paused() {
    for initially_enabled in [false, true] {
        let a_port = free_tcp_port();
        let b_port = free_tcp_port();
        let (rift, mut events) = start_pair(
            "disabled",
            format!("tcp-server://127.0.0.1:{a_port}"),
            format!("tcp-server://127.0.0.1:{b_port}?enabled={initially_enabled}"),
        )
        .await;
        wait_listening(&mut events, Side::A).await;
        if initially_enabled {
            wait_listening(&mut events, Side::B).await;
            rift.set_side_enabled("disabled", Side::B, false)
                .await
                .unwrap();
        }
        let mut client = TcpStream::connect(("127.0.0.1", a_port)).await.unwrap();
        client.write_all(b"received").await.unwrap();
        assert_receive_only(&mut events, Side::A, b"received").await;
        rift.stop_all().await;
    }
}

#[tokio::test]
async fn successful_writes_log_one_receive_and_one_forward_in_each_direction() {
    let a_port = free_tcp_port();
    let b_port = free_tcp_port();
    let (rift, mut events) = start_pair(
        "both",
        format!("tcp-server://127.0.0.1:{a_port}"),
        format!("tcp-server://127.0.0.1:{b_port}"),
    )
    .await;
    wait_listening(&mut events, Side::A).await;
    wait_listening(&mut events, Side::B).await;
    let mut a = TcpStream::connect(("127.0.0.1", a_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;
    let mut b = TcpStream::connect(("127.0.0.1", b_port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::B,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;
    for side in [Side::A, Side::B] {
        let (source, destination) = if side == Side::A {
            (&mut a, &mut b)
        } else {
            (&mut b, &mut a)
        };
        source.write_all(b"ping").await.unwrap();
        assert_eq!(read_exact(destination, 4).await, b"ping");
        for origin in [Origin::Received, Origin::Forwarded] {
            let event = wait_for(&mut events, |event| matches!(event, Event::Data { .. })).await;
            assert!(
                matches!(event, Event::Data { source, target, origin: actual, delivered: true, ref bytes, .. }
                if source == side && target == side.opposite() && actual == origin && bytes == b"ping")
            );
        }
    }
    assert!(events.try_recv().is_err());
    rift.stop_all().await;
}

#[tokio::test]
async fn genuine_udp_write_failure_reports_error_without_successful_delivery() {
    let a_port = free_tcp_port();
    let peer = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let (rift, mut events) = start_pair(
        "failure",
        format!("tcp-server://127.0.0.1:{a_port}?enabled=false"),
        format!("udp://{}", peer.local_addr().unwrap()),
    )
    .await;
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::B,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;
    rift.inject("failure", Target::B, vec![0; 65536]).unwrap();
    let mut error = false;
    let mut failed = false;
    timeout(WAIT, async {
        while !error || !failed {
            match events.recv().await.unwrap() {
                Event::Status {
                    side: Side::B,
                    state: ConnectionState::Error { .. },
                    ..
                } => error = true,
                Event::Data {
                    origin: Origin::Injected,
                    delivered,
                    ..
                } => {
                    assert!(!delivered);
                    failed = true;
                }
                event => panic!("unexpected event: {event:?}"),
            }
        }
    })
    .await
    .unwrap();
    rift.stop_all().await;
}

#[tokio::test]
async fn injecting_into_tcp_listener_requires_a_client_and_never_loops_back() {
    let port = free_tcp_port();
    let (rift, mut events) = start_pair(
        "injection",
        format!("tcp-server://127.0.0.1:{port}"),
        format!("tcp-server://127.0.0.1:{}?enabled=false", free_tcp_port()),
    )
    .await;
    wait_listening(&mut events, Side::A).await;
    while events.try_recv().is_ok() {}
    rift.inject("injection", Target::A, b"zero".to_vec())
        .unwrap();
    let event = timeout(WAIT, events.recv()).await.unwrap().unwrap();
    assert!(matches!(event, Event::Data {
        source: Side::B, target: Side::A, origin: Origin::Injected,
        delivered: false, undelivered_reason: Some(ref reason), ref bytes, ..
    } if reason == "listening but has no connected clients" && bytes == b"zero"));
    assert!(events.try_recv().is_err());
    let mut client = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    wait_for(&mut events, |event| {
        matches!(
            event,
            Event::Status {
                side: Side::A,
                state: ConnectionState::Connected { .. },
                ..
            }
        )
    })
    .await;
    rift.inject("injection", Target::A, b"one".to_vec())
        .unwrap();
    assert_eq!(read_exact(&mut client, 3).await, b"one");
    let event = timeout(WAIT, events.recv()).await.unwrap().unwrap();
    assert!(matches!(event, Event::Data {
        source: Side::B, target: Side::A, origin: Origin::Injected,
        delivered: true, undelivered_reason: None, ref bytes, ..
    } if bytes == b"one"));
    assert!(events.try_recv().is_err());
    drop(client);
    wait_listening(&mut events, Side::A).await;
    rift.inject("injection", Target::A, b"gone".to_vec())
        .unwrap();
    assert!(matches!(
        timeout(WAIT, events.recv()).await.unwrap().unwrap(),
        Event::Data {
            delivered: false,
            undelivered_reason: Some(_),
            ..
        }
    ));
    rift.stop_all().await;
}

#[tokio::test]
async fn injecting_into_paused_or_disabled_sides_explains_unavailability_without_errors() {
    for initially_enabled in [false, true] {
        let (rift, mut events) = start_pair(
            "paused-injection",
            format!(
                "tcp-server://127.0.0.1:{}?enabled={initially_enabled}",
                free_tcp_port()
            ),
            format!(
                "tcp-server://127.0.0.1:{}?enabled={initially_enabled}",
                free_tcp_port()
            ),
        )
        .await;
        let mut ready = [false; 2];
        timeout(WAIT, async {
            while !ready.iter().all(|ready| *ready) {
                match events.recv().await.unwrap() {
                    Event::Status { side, state, .. }
                        if state
                            == if initially_enabled {
                                ConnectionState::Listening
                            } else {
                                ConnectionState::Disabled
                            } =>
                    {
                        ready[if side == Side::A { 0 } else { 1 }] = true;
                    }
                    event => panic!("unexpected event: {event:?}"),
                }
            }
        })
        .await
        .unwrap();
        for side in [Side::A, Side::B] {
            if initially_enabled {
                rift.set_side_enabled("paused-injection", side, false)
                    .await
                    .unwrap();
                loop {
                    match timeout(WAIT, events.recv()).await.unwrap().unwrap() {
                        Event::Status {
                            side: actual,
                            state: ConnectionState::Disabled,
                            ..
                        } if actual == side => break,
                        Event::Status {
                            state: ConnectionState::Disconnected { .. },
                            ..
                        } => {}
                        event => panic!("unexpected event: {event:?}"),
                    }
                }
            }
            rift.inject(
                "paused-injection",
                if side == Side::A {
                    Target::A
                } else {
                    Target::B
                },
                b"paused".to_vec(),
            )
            .unwrap();
            let event = timeout(WAIT, events.recv()).await.unwrap().unwrap();
            assert!(matches!(event, Event::Data {
                source, target, origin: Origin::Injected, delivered: false,
                undelivered_reason: Some(ref reason), ref bytes, ..
            } if source == side.opposite() && target == side && reason == "paused" && bytes == b"paused"));
        }
        assert!(events.try_recv().is_err());
        rift.stop_all().await;
    }
}
