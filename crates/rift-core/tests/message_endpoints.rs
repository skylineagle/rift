use std::net::TcpListener as StdTcpListener;
use std::time::Duration;

use amqprs::channel::{
    BasicConsumeArguments, BasicPublishArguments, QueueDeclareArguments, QueuePurgeArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::BasicProperties;
use futures_util::{SinkExt, StreamExt};
use rift_core::{ConnectionState, Event, Profile, Rift, Side};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast::Receiver;
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;

const WAIT: Duration = Duration::from_secs(10);

fn free_port() -> u16 {
    StdTcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

async fn wait_for_state(
    events: &mut Receiver<Event>,
    side: Side,
    expected: fn(&ConnectionState) -> bool,
) {
    timeout(WAIT, async {
        loop {
            if let Event::Status { side: s, state, .. } = events.recv().await.unwrap() {
                if s == side && expected(&state) {
                    return;
                }
            }
        }
    })
    .await
    .expect("timed out waiting for state");
}

fn is_listening(state: &ConnectionState) -> bool {
    matches!(state, ConnectionState::Listening)
}

fn is_connected(state: &ConnectionState) -> bool {
    matches!(state, ConnectionState::Connected { .. })
}

fn is_handshake_timeout(state: &ConnectionState) -> bool {
    matches!(state, ConnectionState::Error { message } if message.contains("timed out"))
}

async fn read_exact(stream: &mut TcpStream, length: usize) -> Vec<u8> {
    let mut buffer = vec![0u8; length];
    timeout(WAIT, stream.read_exact(&mut buffer))
        .await
        .unwrap()
        .unwrap();
    buffer
}

fn start(rift: &Rift, a: String, tcp_port: u16) {
    rift.start(Profile {
        name: "test".into(),
        a: a.parse().unwrap(),
        b: format!("tcp-server://127.0.0.1:{tcp_port}")
            .parse()
            .unwrap(),
        workflows: Vec::new(),
    })
    .unwrap();
}

#[tokio::test]
async fn websocket_server_broadcasts_json_wrapped_base64() {
    let ws_port = free_port();
    let tcp_port = free_port();
    let rift = Rift::new();
    let mut events = rift.subscribe();
    start(
        &rift,
        format!(
            "ws-server://127.0.0.1:{ws_port}/feed?format=json&json_field=msg.raw&json_value=base64"
        ),
        tcp_port,
    );
    wait_for_state(&mut events, Side::A, is_listening).await;
    wait_for_state(&mut events, Side::B, is_listening).await;

    let rejected =
        tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{ws_port}/other")).await;
    assert!(rejected.is_err());

    let (mut first, _) = tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{ws_port}/feed"))
        .await
        .unwrap();
    wait_for_state(&mut events, Side::A, is_connected).await;
    let (mut second, _) =
        tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{ws_port}/feed"))
            .await
            .unwrap();
    wait_for_state(&mut events, Side::A, is_connected).await;
    let mut tcp = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for_state(&mut events, Side::B, is_connected).await;

    first
        .send(Message::text(r#"{"msg":{"raw":"aGk="}}"#))
        .await
        .unwrap();
    assert_eq!(read_exact(&mut tcp, 2).await, b"hi");

    tcp.write_all(b"\x00\xff").await.unwrap();
    for client in [&mut first, &mut second] {
        let message = timeout(WAIT, client.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(message, Message::text(r#"{"msg":{"raw":"AP8="}}"#));
    }
    rift.stop("test").await.unwrap();
}

#[tokio::test]
async fn websocket_server_reserves_a_slot_until_the_handshake_times_out() {
    let ws_port = free_port();
    let tcp_port = free_port();
    let rift = Rift::new();
    let mut events = rift.subscribe();
    start(
        &rift,
        format!("ws-server://127.0.0.1:{ws_port}?max_clients=1"),
        tcp_port,
    );
    wait_for_state(&mut events, Side::A, is_listening).await;
    let url = format!("ws://127.0.0.1:{ws_port}/");

    let _silent = TcpStream::connect(("127.0.0.1", ws_port)).await.unwrap();
    assert!(tokio_tungstenite::connect_async(&url).await.is_err());

    wait_for_state(&mut events, Side::A, is_handshake_timeout).await;
    tokio_tungstenite::connect_async(&url).await.unwrap();
    wait_for_state(&mut events, Side::A, is_connected).await;
    rift.stop("test").await.unwrap();
}

#[tokio::test]
async fn websocket_client_reconnects_and_sends_text() {
    let ws_port = free_port();
    let tcp_port = free_port();
    let listener = TcpListener::bind(("127.0.0.1", ws_port)).await.unwrap();
    let rift = Rift::new();
    let mut events = rift.subscribe();
    start(
        &rift,
        format!("ws://127.0.0.1:{ws_port}/?format=text"),
        tcp_port,
    );
    wait_for_state(&mut events, Side::B, is_listening).await;
    let mut tcp = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for_state(&mut events, Side::B, is_connected).await;

    for round in [b"one", b"two"] {
        let (stream, _) = timeout(WAIT, listener.accept()).await.unwrap().unwrap();
        let mut server = tokio_tungstenite::accept_async(stream).await.unwrap();
        wait_for_state(&mut events, Side::A, is_connected).await;
        server.send(Message::binary(round.to_vec())).await.unwrap();
        assert_eq!(read_exact(&mut tcp, 3).await, round);
        tcp.write_all(round).await.unwrap();
        let message = timeout(WAIT, server.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(message, Message::text(std::str::from_utf8(round).unwrap()));
        drop(server);
    }
    rift.stop("test").await.unwrap();
}

#[tokio::test]
#[ignore = "needs a RabbitMQ broker, set RIFT_AMQP_URL (e.g. amqp://guest:guest@localhost:5672)"]
async fn rabbitmq_consumes_and_publishes() {
    let url = std::env::var("RIFT_AMQP_URL").expect("RIFT_AMQP_URL");
    let tcp_port = free_port();
    let connection = Connection::open(&OpenConnectionArguments::try_from(url.as_str()).unwrap())
        .await
        .unwrap();
    let channel = connection.open_channel(None).await.unwrap();
    channel
        .queue_declare(QueueDeclareArguments::durable_client_named("rift-test-out"))
        .await
        .unwrap();
    channel
        .queue_purge(QueuePurgeArguments::new("rift-test-out"))
        .await
        .unwrap();

    let rift = Rift::new();
    let mut events = rift.subscribe();
    start(
        &rift,
        format!(
            "{url}?exchange=rift-test&exchange_type=topic&declare_exchange=true&routing_key=out.raw&queue=rift-test-in&queue_type=quorum&binding_key=in.%23&message_ttl_ms=60000"
        )
        .replace("%23", "#"),
        tcp_port,
    );
    wait_for_state(&mut events, Side::A, is_connected).await;
    channel
        .queue_bind(amqprs::channel::QueueBindArguments::new(
            "rift-test-out",
            "rift-test",
            "out.raw",
        ))
        .await
        .unwrap();
    let mut tcp = TcpStream::connect(("127.0.0.1", tcp_port)).await.unwrap();
    wait_for_state(&mut events, Side::B, is_connected).await;

    channel
        .basic_publish(
            BasicProperties::default(),
            b"from-broker".to_vec(),
            BasicPublishArguments::new("rift-test", "in.sensor"),
        )
        .await
        .unwrap();
    assert_eq!(read_exact(&mut tcp, 11).await, b"from-broker");

    let (_, mut deliveries) = channel
        .basic_consume_rx(BasicConsumeArguments::new("rift-test-out", "").finish())
        .await
        .unwrap();
    tcp.write_all(b"to-broker").await.unwrap();
    let delivery = timeout(WAIT, deliveries.recv()).await.unwrap().unwrap();
    assert_eq!(delivery.content.unwrap(), b"to-broker");
    rift.stop("test").await.unwrap();
}
