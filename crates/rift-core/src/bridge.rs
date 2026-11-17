use std::sync::{Arc, Mutex};

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::{broadcast, mpsc, watch, Mutex as AsyncMutex};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

use crate::drops::DropTally;
use crate::endpoint::link::{Context, Link, WriteRequest};
use crate::endpoint::{self, Endpoint};
use crate::event::{ConnectionState, Event, Origin};
use crate::peers::PeerCounter;
use crate::profile::Profile;
use crate::side::{Side, Target};
use crate::side_config::SideConfig;

const EVENT_CAPACITY: usize = 1024;
const CHANNEL_CAPACITY: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SideStatus {
    pub state: ConnectionState,
    pub peers: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BridgeStatus {
    pub profile: String,
    pub a: SideStatus,
    pub b: SideStatus,
}

struct OpenLink {
    writes: mpsc::Sender<WriteRequest>,
    peers: PeerCounter,
    tcp_server: bool,
    drops: DropTally,
}

#[derive(Clone)]
struct SideHandle {
    open: Arc<Mutex<Option<OpenLink>>>,
    state: watch::Receiver<ConnectionState>,
}

impl SideHandle {
    fn deliver(&self, request: WriteRequest) -> Result<bool, String> {
        let mut open = self.open.lock().unwrap();
        let Some(link) = open.as_mut() else {
            request.unavailable("paused".to_string());
            return Ok(false);
        };
        if !link.peers.is_connected() {
            if link.tcp_server && matches!(*self.state.borrow(), ConnectionState::Listening) {
                request.unavailable("listening but has no connected clients".to_string());
            }
            return Ok(false);
        }
        if let Some(chunks) = link.drops.take_due() {
            request.report_dropped(None, chunks);
        }
        match link.writes.try_send(request) {
            Ok(()) => Ok(true),
            Err(TrySendError::Full(request)) => {
                link.drops.add(1);
                if let Some(chunks) = link.drops.take_due() {
                    request.report_dropped(None, chunks);
                }
                Ok(false)
            }
            Err(error) => Err(error.to_string()),
        }
    }

    fn status(&self) -> SideStatus {
        SideStatus {
            state: self.state.borrow().clone(),
            peers: self
                .open
                .lock()
                .unwrap()
                .as_ref()
                .map_or(0, |link| link.peers.count()),
        }
    }

    fn close(&self) {
        self.open.lock().unwrap().take();
    }
}

struct RunningEndpoint {
    cancel: CancellationToken,
    task: JoinHandle<()>,
}

struct SideControl {
    endpoint: Mutex<Endpoint>,
    handle: SideHandle,
    reads: mpsc::Sender<Bytes>,
    states: mpsc::Sender<ConnectionState>,
    running: AsyncMutex<Option<RunningEndpoint>>,
}

impl SideControl {
    fn open(&self, parent: &CancellationToken) -> RunningEndpoint {
        let (writes_sender, writes) = mpsc::channel(CHANNEL_CAPACITY);
        let peers = PeerCounter::default();
        let cancel = parent.child_token();
        *self.handle.open.lock().unwrap() = Some(OpenLink {
            writes: writes_sender,
            peers: peers.clone(),
            drops: DropTally::default(),
            tcp_server: matches!(*self.endpoint.lock().unwrap(), Endpoint::TcpServer(_)),
        });
        let link = Link {
            writes,
            context: Context {
                reads: self.reads.clone(),
                states: self.states.clone(),
                peers,
                cancel: cancel.clone(),
            },
        };
        RunningEndpoint {
            cancel,
            task: tokio::spawn(endpoint::run(self.endpoint.lock().unwrap().clone(), link)),
        }
    }

    async fn enable(&self, parent: &CancellationToken) {
        let mut running = self.running.lock().await;
        if running.is_none() {
            *running = Some(self.open(parent));
        }
    }

    async fn disable(&self) {
        let mut running = self.running.lock().await;
        self.handle.close();
        if let Some(endpoint) = running.take() {
            endpoint.cancel.cancel();
            let _ = endpoint.task.await;
        }
        let _ = self.states.send(ConnectionState::Disabled).await;
    }
}

fn create_side(
    config: SideConfig,
    parent: &CancellationToken,
) -> (
    SideControl,
    mpsc::Receiver<Bytes>,
    mpsc::Receiver<ConnectionState>,
    watch::Sender<ConnectionState>,
) {
    let (reads_sender, reads) = mpsc::channel(CHANNEL_CAPACITY);
    let (states_sender, states) = mpsc::channel(CHANNEL_CAPACITY);
    let initial = if config.enabled {
        ConnectionState::Disconnected { peer: None }
    } else {
        ConnectionState::Disabled
    };
    let (state_sender, state) = watch::channel(initial);
    let control = SideControl {
        endpoint: Mutex::new(config.endpoint),
        handle: SideHandle {
            open: Arc::new(Mutex::new(None)),
            state,
        },
        reads: reads_sender,
        states: states_sender,
        running: AsyncMutex::new(None),
    };
    if config.enabled {
        *control.running.try_lock().unwrap() = Some(control.open(parent));
    }
    (control, reads, states, state_sender)
}

pub struct Bridge {
    profile: String,
    events: broadcast::Sender<Event>,
    a: SideControl,
    b: SideControl,
    cancel: CancellationToken,
    relay_cancel: CancellationToken,
    relays: Mutex<Vec<JoinHandle<()>>>,
}

impl Bridge {
    pub fn start(profile: Profile) -> Self {
        let (events, _) = broadcast::channel(EVENT_CAPACITY);
        Self::start_with_events(profile, events)
    }

    pub(crate) fn start_with_events(profile: Profile, events: broadcast::Sender<Event>) -> Self {
        let cancel = CancellationToken::new();
        let relay_cancel = CancellationToken::new();
        let a_enabled = profile.a.enabled;
        let b_enabled = profile.b.enabled;
        let (a, a_reads, a_states, a_state_sender) = create_side(profile.a, &cancel);
        let (b, b_reads, b_states, b_state_sender) = create_side(profile.b, &cancel);
        for (enabled, control) in [(a_enabled, &a), (b_enabled, &b)] {
            if !enabled {
                let _ = control.states.try_send(ConnectionState::Disabled);
            }
        }
        let relays = vec![
            tokio::spawn(relay_side(
                profile.name.clone(),
                Side::A,
                RelayChannels {
                    states: a_states,
                    reads: a_reads,
                    state_sender: a_state_sender,
                    stop: relay_cancel.clone(),
                },
                b.handle.clone(),
                events.clone(),
            )),
            tokio::spawn(relay_side(
                profile.name.clone(),
                Side::B,
                RelayChannels {
                    states: b_states,
                    reads: b_reads,
                    state_sender: b_state_sender,
                    stop: relay_cancel.clone(),
                },
                a.handle.clone(),
                events.clone(),
            )),
        ];
        Self {
            profile: profile.name,
            events,
            a,
            b,
            cancel,
            relay_cancel,
            relays: Mutex::new(relays),
        }
    }

    pub fn name(&self) -> &str {
        &self.profile
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.events.subscribe()
    }

    pub fn inject(&self, target: Target, bytes: impl Into<Bytes>) {
        let bytes: Bytes = bytes.into();
        for side in target.sides() {
            let request = WriteRequest::new(
                bytes.clone(),
                Event::data(
                    &self.profile,
                    side.opposite(),
                    side,
                    Origin::Injected,
                    &bytes,
                    true,
                ),
                self.events.clone(),
            );
            if let Err(message) = self.side(side).handle.deliver(request) {
                let _ = self.events.send(Event::status(
                    &self.profile,
                    side,
                    ConnectionState::Error { message },
                ));
            }
        }
    }

    pub fn status(&self) -> BridgeStatus {
        BridgeStatus {
            profile: self.profile.clone(),
            a: self.a.handle.status(),
            b: self.b.handle.status(),
        }
    }

    pub async fn set_side_enabled(&self, side: Side, enabled: bool) {
        let control = self.side(side);
        if enabled {
            control.enable(&self.cancel).await;
        } else {
            control.disable().await;
        }
    }

    pub async fn configure_side(&self, side: Side, config: SideConfig) {
        let control = self.side(side);
        control.disable().await;
        *control.endpoint.lock().unwrap() = config.endpoint;
        if config.enabled {
            control.enable(&self.cancel).await;
        }
    }

    pub async fn stop(&self) {
        self.cancel.cancel();
        for control in [&self.a, &self.b] {
            if let Some(endpoint) = control.running.lock().await.take() {
                let _ = endpoint.task.await;
            }
        }
        self.relay_cancel.cancel();
        let relays = std::mem::take(&mut *self.relays.lock().unwrap());
        for relay in relays {
            let _ = relay.await;
        }
    }

    fn side(&self, side: Side) -> &SideControl {
        match side {
            Side::A => &self.a,
            Side::B => &self.b,
        }
    }
}

impl Drop for Bridge {
    fn drop(&mut self) {
        self.cancel.cancel();
        self.relay_cancel.cancel();
    }
}

struct RelayChannels {
    states: mpsc::Receiver<ConnectionState>,
    reads: mpsc::Receiver<Bytes>,
    state_sender: watch::Sender<ConnectionState>,
    stop: CancellationToken,
}

async fn relay_side(
    profile: String,
    side: Side,
    mut channels: RelayChannels,
    opposite: SideHandle,
    events: broadcast::Sender<Event>,
) {
    loop {
        tokio::select! {
            biased;
            Some(state) = channels.states.recv() => {
                channels.state_sender.send_replace(state.clone());
                let _ = events.send(Event::status(&profile, side, state));
            }
            Some(bytes) = channels.reads.recv() => {
                let _ = events.send(Event::data(
                    &profile, side, side.opposite(), Origin::Received, &bytes, true,
                ));
                let request = WriteRequest::new(
                    bytes.clone(),
                    Event::data(&profile, side, side.opposite(), Origin::Forwarded, &bytes, true),
                    events.clone(),
                );
                if let Err(message) = opposite.deliver(request) {
                    let _ = events.send(Event::status(&profile, side.opposite(), ConnectionState::Error { message }));
                }
            }
            _ = channels.stop.cancelled() => break,
        }
    }
}
