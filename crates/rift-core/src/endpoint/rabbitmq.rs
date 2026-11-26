mod acknowledgements;
mod publisher;

use std::io;
use std::time::Duration;

use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicPublishArguments, BasicQosArguments, Channel,
    ConfirmSelectArguments, ConsumerMessage, ExchangeDeclareArguments, QueueBindArguments,
    QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::{BasicProperties, FieldTable, FieldValue};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::time::timeout;

use self::acknowledgements::{Acknowledgements, Held, Settlement};
use self::publisher::{BrokerCallbacks, BrokerSignal, Outbox};
use super::client_session::{run_session_client, Session};
use super::link::{Context, Link, WriteRequest};
use super::message_format::text_enum;
use super::tcp_client::{default_connect_timeout_ms, default_reconnect_delay_ms};
use crate::redact::redact_url;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExchangeKind {
    #[default]
    Direct,
    Fanout,
    Topic,
    Headers,
}

text_enum!(ExchangeKind, "exchange_type", {
    Direct => "direct",
    Fanout => "fanout",
    Topic => "topic",
    Headers => "headers",
});

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueKind {
    #[default]
    Classic,
    Quorum,
    Stream,
}

text_enum!(QueueKind, "queue_type", {
    Classic => "classic",
    Quorum => "quorum",
    Stream => "stream",
});

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RabbitMqConfig {
    pub url: String,
    #[serde(default)]
    pub exchange: String,
    #[serde(default)]
    pub exchange_type: ExchangeKind,
    #[serde(default)]
    pub declare_exchange: bool,
    #[serde(default)]
    pub routing_key: String,
    #[serde(default)]
    pub queue: Option<String>,
    #[serde(default = "enabled")]
    pub declare_queue: bool,
    #[serde(default)]
    pub queue_type: QueueKind,
    #[serde(default = "enabled")]
    pub durable: bool,
    #[serde(default)]
    pub exclusive: bool,
    #[serde(default)]
    pub auto_delete: bool,
    #[serde(default)]
    pub binding_key: Option<String>,
    #[serde(default)]
    pub message_ttl_ms: Option<u64>,
    #[serde(default)]
    pub expires_ms: Option<u64>,
    #[serde(default)]
    pub max_length: Option<u64>,
    #[serde(default)]
    pub max_length_bytes: Option<u64>,
    #[serde(default)]
    pub dead_letter_exchange: Option<String>,
    #[serde(default)]
    pub dead_letter_routing_key: Option<String>,
    #[serde(default)]
    pub max_priority: Option<u8>,
    #[serde(default = "default_prefetch")]
    pub prefetch: u16,
    #[serde(default)]
    pub persistent: bool,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default = "default_reconnect_delay_ms")]
    pub reconnect_delay_ms: u64,
    #[serde(default = "default_connect_timeout_ms")]
    pub connect_timeout_ms: u64,
}

const SHORT_STRING_LIMIT: usize = 255;

fn enabled() -> bool {
    true
}

pub(crate) fn default_prefetch() -> u16 {
    50
}

impl RabbitMqConfig {
    pub fn new(url: String) -> Self {
        Self {
            url,
            exchange: String::new(),
            exchange_type: ExchangeKind::default(),
            declare_exchange: false,
            routing_key: String::new(),
            queue: None,
            declare_queue: true,
            queue_type: QueueKind::default(),
            durable: true,
            exclusive: false,
            auto_delete: false,
            binding_key: None,
            message_ttl_ms: None,
            expires_ms: None,
            max_length: None,
            max_length_bytes: None,
            dead_letter_exchange: None,
            dead_letter_routing_key: None,
            max_priority: None,
            prefetch: default_prefetch(),
            persistent: false,
            content_type: None,
            reconnect_delay_ms: default_reconnect_delay_ms(),
            connect_timeout_ms: default_connect_timeout_ms(),
        }
    }

    pub fn display_target(&self) -> String {
        let redacted = redact_url(&self.url);
        let host = redacted
            .split_once("://")
            .map_or(redacted.as_str(), |(_, host)| host);
        match &self.queue {
            Some(queue) if !queue.is_empty() => format!("{host} · {queue}"),
            _ if !self.exchange.is_empty() => format!("{host} · {}", self.exchange),
            _ => host.to_string(),
        }
    }

    fn connection_arguments(&self) -> Result<OpenConnectionArguments, String> {
        let arguments = OpenConnectionArguments::try_from(self.url.as_str())
            .map_err(|error| format!("invalid broker url: {error}"))?;
        let short_strings = [
            ("virtual host", Some(arguments.get_virtual_host())),
            ("exchange", Some(self.exchange.as_str())),
            ("routing_key", Some(self.routing_key.as_str())),
            ("queue", self.queue.as_deref()),
            ("binding_key", self.binding_key.as_deref()),
            ("content_type", self.content_type.as_deref()),
        ];
        let oversized = short_strings
            .iter()
            .find(|(_, value)| value.is_some_and(|value| value.len() > SHORT_STRING_LIMIT));
        match oversized {
            Some((name, _)) => Err(format!("{name} is longer than {SHORT_STRING_LIMIT} bytes")),
            None => Ok(arguments),
        }
    }

    fn publishes(&self) -> bool {
        !self.exchange.is_empty() || !self.routing_key.is_empty()
    }

    fn queue_arguments(&self) -> FieldTable {
        let mut table = FieldTable::new();
        let mut put = |key: &str, value: FieldValue| {
            table.insert(key.try_into().expect("short argument name"), value);
        };
        if self.queue_type != QueueKind::Classic {
            put("x-queue-type", self.queue_type.to_string().into());
        }
        let numbers = [
            ("x-message-ttl", self.message_ttl_ms),
            ("x-expires", self.expires_ms),
            ("x-max-length", self.max_length),
            ("x-max-length-bytes", self.max_length_bytes),
            ("x-max-priority", self.max_priority.map(u64::from)),
        ];
        for (key, value) in numbers {
            if let Some(value) = value {
                put(key, FieldValue::l(value.min(i64::MAX as u64) as i64));
            }
        }
        let texts = [
            ("x-dead-letter-exchange", &self.dead_letter_exchange),
            ("x-dead-letter-routing-key", &self.dead_letter_routing_key),
        ];
        for (key, value) in texts {
            if let Some(value) = value {
                put(key, value.as_str().into());
            }
        }
        table
    }

    fn properties(&self) -> BasicProperties {
        let mut properties = BasicProperties::default();
        properties.with_persistence(self.persistent);
        if let Some(content_type) = &self.content_type {
            properties.with_content_type(content_type);
        }
        properties.finish()
    }
}

struct RabbitSession<'a> {
    config: &'a RabbitMqConfig,
    connection: Connection,
    channel: Channel,
    deliveries: Option<mpsc::UnboundedReceiver<ConsumerMessage>>,
    signals: mpsc::UnboundedReceiver<BrokerSignal>,
    acknowledgements: Acknowledgements,
    outbox: Outbox,
}

impl Session for RabbitSession<'_> {
    async fn serve(
        mut self,
        context: &Context,
        writes: &mut mpsc::Receiver<WriteRequest>,
    ) -> io::Result<()> {
        let result = self.pump(context, writes).await;
        let _ = self.channel.close().await;
        let _ = self.connection.close().await;
        result
    }
}

impl RabbitSession<'_> {
    async fn pump(
        &mut self,
        context: &Context,
        writes: &mut mpsc::Receiver<WriteRequest>,
    ) -> io::Result<()> {
        let connection = self.connection.clone();
        let network_failure = connection.listen_network_io_failure();
        tokio::pin!(network_failure);
        loop {
            tokio::select! {
                _ = context.cancel.cancelled() => return Ok(()),
                signal = self.signals.recv() => match signal {
                    Some(signal) => self.handle_signal(signal, context).await?,
                    None => return Err(broker_error("channel to broker lost")),
                },
                _ = &mut network_failure => return Err(broker_error("connection to broker lost")),
                settlement = self.acknowledgements.next() => {
                    if !self.settle(settlement, context).await? {
                        return Ok(());
                    }
                }
                delivery = next_delivery(&mut self.deliveries) => match delivery {
                    Some(message) => {
                        if !self.forward(message, context).await {
                            return Ok(());
                        }
                    }
                    None => return Err(self.consumer_end_error()),
                },
                outgoing = writes.recv(), if !self.outbox.is_full() => match outgoing {
                    Some(request) => self.publish(request).await?,
                    None => return Ok(()),
                },
            }
        }
    }

    fn consumer_end_error(&mut self) -> io::Error {
        while let Ok(signal) = self.signals.try_recv() {
            if let BrokerSignal::ChannelClosed { reason } = signal {
                return channel_closed_error(&reason);
            }
        }
        broker_error("broker cancelled the consumer")
    }

    async fn forward(&mut self, message: ConsumerMessage, context: &Context) -> bool {
        let content = Bytes::from(message.content.unwrap_or_default());
        let Some(confirmation) = context.forward_confirmed(content.clone()).await else {
            return false;
        };
        if let Some(deliver) = message.deliver {
            let held = Held {
                delivery_tag: deliver.delivery_tag(),
                content,
            };
            self.acknowledgements.track(held, confirmation);
        }
        true
    }

    async fn settle(&mut self, settlement: Settlement, context: &Context) -> io::Result<bool> {
        match settlement {
            Settlement::Acknowledge(delivery_tag) => {
                self.channel
                    .basic_ack(BasicAckArguments::new(delivery_tag, false))
                    .await
                    .map_err(io::Error::other)?;
            }
            Settlement::Retry(deliveries) => {
                for held in deliveries {
                    let Some(confirmation) = context.retry_confirmed(held.content.clone()).await
                    else {
                        return Ok(false);
                    };
                    self.acknowledgements.track(held, confirmation);
                }
            }
        }
        Ok(true)
    }

    async fn publish(&mut self, request: WriteRequest) -> io::Result<()> {
        if !self.config.publishes() {
            request.unavailable("no exchange or routing key to publish to".into());
            return Ok(());
        }
        let arguments = BasicPublishArguments::new(&self.config.exchange, &self.config.routing_key)
            .mandatory(true)
            .finish();
        let content = request.bytes.to_vec();
        let mut properties = self.config.properties();
        self.outbox.track(request, &mut properties);
        self.channel
            .basic_publish(properties, content, arguments)
            .await
            .map_err(io::Error::other)
    }

    async fn handle_signal(&mut self, signal: BrokerSignal, context: &Context) -> io::Result<()> {
        match signal {
            BrokerSignal::Confirmed {
                sequence,
                multiple,
                accepted,
            } => {
                let requests = self.outbox.take_confirmed(sequence, multiple);
                if accepted {
                    requests.iter().for_each(WriteRequest::delivered);
                } else {
                    for request in requests {
                        reject(request, "broker rejected the publish".into(), context).await;
                    }
                }
            }
            BrokerSignal::Returned { sequence, reason } => {
                if let Some(request) = self.outbox.take(sequence) {
                    reject(request, reason, context).await;
                }
            }
            BrokerSignal::ChannelClosed { reason } => return Err(channel_closed_error(&reason)),
        }
        Ok(())
    }
}

async fn reject(request: WriteRequest, reason: String, context: &Context) {
    context.report_error(&reason).await;
    request.unavailable(reason);
}

async fn next_delivery(
    deliveries: &mut Option<mpsc::UnboundedReceiver<ConsumerMessage>>,
) -> Option<ConsumerMessage> {
    match deliveries {
        Some(receiver) => receiver.recv().await,
        None => std::future::pending().await,
    }
}

fn broker_error(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::ConnectionAborted, message.to_string())
}

fn channel_closed_error(reason: &str) -> io::Error {
    broker_error(&format!("broker closed the channel: {reason}"))
}

pub(crate) async fn run(config: RabbitMqConfig, link: Link) {
    let arguments = match config.connection_arguments() {
        Ok(arguments) => arguments,
        Err(reason) => return link.context.report_error(reason).await,
    };
    let reconnect_delay = Duration::from_millis(config.reconnect_delay_ms);
    run_session_client(config.display_target(), link, reconnect_delay, || async {
        let limit = Duration::from_millis(config.connect_timeout_ms);
        timeout(limit, open_session(&config, &arguments))
            .await
            .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "connect timed out"))?
    })
    .await;
}

async fn open_session<'a>(
    config: &'a RabbitMqConfig,
    arguments: &OpenConnectionArguments,
) -> io::Result<RabbitSession<'a>> {
    let connection = Connection::open(arguments)
        .await
        .map_err(io::Error::other)?;
    let channel = connection
        .open_channel(None)
        .await
        .map_err(io::Error::other)?;
    let (callbacks, signals) = BrokerCallbacks::channel();
    channel
        .register_callback(callbacks)
        .await
        .map_err(io::Error::other)?;
    if config.publishes() {
        channel
            .confirm_select(ConfirmSelectArguments::default())
            .await
            .map_err(io::Error::other)?;
    }
    let deliveries = prepare_topology(config, &channel)
        .await
        .map_err(io::Error::other)?;
    Ok(RabbitSession {
        config,
        connection,
        channel,
        deliveries,
        signals,
        acknowledgements: Acknowledgements::new(Duration::from_millis(config.reconnect_delay_ms)),
        outbox: Outbox::default(),
    })
}

async fn prepare_topology(
    config: &RabbitMqConfig,
    channel: &Channel,
) -> Result<Option<mpsc::UnboundedReceiver<ConsumerMessage>>, amqprs::error::Error> {
    if config.declare_exchange && !config.exchange.is_empty() {
        let mut arguments =
            ExchangeDeclareArguments::new(&config.exchange, &config.exchange_type.to_string());
        arguments.durable = config.durable;
        channel.exchange_declare(arguments).await?;
    }
    let Some(queue) = &config.queue else {
        return Ok(None);
    };
    let declared = channel
        .queue_declare(
            QueueDeclareArguments::new(queue)
                .passive(!config.declare_queue)
                .durable(config.durable)
                .exclusive(config.exclusive)
                .auto_delete(config.auto_delete)
                .arguments(config.queue_arguments())
                .finish(),
        )
        .await?;
    let queue = declared.map_or_else(|| queue.clone(), |(name, _, _)| name);
    if !config.exchange.is_empty() {
        let binding_key = config.binding_key.as_ref().unwrap_or(&config.routing_key);
        channel
            .queue_bind(QueueBindArguments::new(
                &queue,
                &config.exchange,
                binding_key,
            ))
            .await?;
    }
    channel
        .basic_qos(BasicQosArguments::new(0, config.prefetch, false))
        .await?;
    let (_, deliveries) = channel
        .basic_consume_rx(
            BasicConsumeArguments::new(&queue, "")
                .manual_ack(true)
                .finish(),
        )
        .await?;
    Ok(Some(deliveries))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_arguments_only_include_what_is_set() {
        let mut config = RabbitMqConfig::new("amqp://h".into());
        assert!(config.queue_arguments().as_ref().is_empty());
        config.queue_type = QueueKind::Quorum;
        config.message_ttl_ms = Some(60_000);
        config.dead_letter_exchange = Some("dlx".into());
        let arguments = config.queue_arguments();
        let keys: Vec<String> = arguments
            .as_ref()
            .keys()
            .map(|key| key.to_string())
            .collect();
        assert_eq!(arguments.as_ref().len(), 3);
        for key in ["x-queue-type", "x-message-ttl", "x-dead-letter-exchange"] {
            assert!(keys.contains(&key.to_string()), "{key}");
        }
    }

    #[test]
    fn short_string_fields_are_limited_to_255_bytes() {
        let mut config = RabbitMqConfig::new("amqp://h".into());
        config.routing_key = "k".repeat(255);
        assert!(config.connection_arguments().is_ok());
        let fields: [fn(&mut RabbitMqConfig, String); 5] = [
            |config, value| config.exchange = value,
            |config, value| config.routing_key = value,
            |config, value| config.queue = Some(value),
            |config, value| config.binding_key = Some(value),
            |config, value| config.content_type = Some(value),
        ];
        for set in fields {
            let mut config = RabbitMqConfig::new("amqp://h".into());
            set(&mut config, "é".repeat(128));
            assert!(config.connection_arguments().is_err());
        }
        let long_host = RabbitMqConfig::new(format!("amqp://h/{}", "v".repeat(256)));
        assert!(long_host.connection_arguments().is_err());
    }

    #[test]
    fn display_target_hides_credentials() {
        let mut config = RabbitMqConfig::new("amqp://user:secret@broker:5672/vhost".into());
        assert_eq!(config.display_target(), "broker:5672/vhost");
        config.queue = Some("orders".into());
        assert_eq!(config.display_target(), "broker:5672/vhost · orders");
    }
}
