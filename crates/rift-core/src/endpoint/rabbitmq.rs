use std::io;
use std::time::Duration;

use amqprs::channel::{
    BasicAckArguments, BasicConsumeArguments, BasicPublishArguments, BasicQosArguments, Channel,
    ConsumerMessage, ExchangeDeclareArguments, QueueBindArguments, QueueDeclareArguments,
};
use amqprs::connection::{Connection, OpenConnectionArguments};
use amqprs::{BasicProperties, FieldTable, FieldValue};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::time::timeout;

use super::client_session::{run_session_client, Session};
use super::link::{Context, Link, WriteRequest};
use super::message_format::text_enum;
use super::tcp_client::{default_connect_timeout_ms, default_reconnect_delay_ms};

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
        let host = self
            .url
            .split_once('@')
            .map_or(self.url.as_str(), |(_, host)| host);
        match &self.queue {
            Some(queue) if !queue.is_empty() => format!("{host} · {queue}"),
            _ if !self.exchange.is_empty() => format!("{host} · {}", self.exchange),
            _ => host.to_string(),
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
                _ = &mut network_failure => return Err(broker_error("connection to broker lost")),
                delivery = next_delivery(&mut self.deliveries) => match delivery {
                    Some(message) => {
                        if !self.forward(message, context).await? {
                            return Ok(());
                        }
                    }
                    None => return Err(broker_error("broker cancelled the consumer")),
                },
                outgoing = writes.recv() => match outgoing {
                    Some(request) => self.publish(request).await?,
                    None => return Ok(()),
                },
            }
        }
    }

    async fn forward(&self, message: ConsumerMessage, context: &Context) -> io::Result<bool> {
        let content = Bytes::from(message.content.unwrap_or_default());
        let forwarded = context.forward(content).await;
        if let Some(deliver) = message.deliver {
            self.channel
                .basic_ack(BasicAckArguments::new(deliver.delivery_tag(), false))
                .await
                .map_err(io::Error::other)?;
        }
        Ok(forwarded)
    }

    async fn publish(&self, request: WriteRequest) -> io::Result<()> {
        if !self.config.publishes() {
            request.unavailable("no exchange or routing key to publish to".into());
            return Ok(());
        }
        let arguments = BasicPublishArguments::new(&self.config.exchange, &self.config.routing_key);
        self.channel
            .basic_publish(self.config.properties(), request.bytes.to_vec(), arguments)
            .await
            .map_err(io::Error::other)?;
        request.delivered();
        Ok(())
    }
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

pub(crate) async fn run(config: RabbitMqConfig, link: Link) {
    let reconnect_delay = Duration::from_millis(config.reconnect_delay_ms);
    run_session_client(config.display_target(), link, reconnect_delay, || async {
        let limit = Duration::from_millis(config.connect_timeout_ms);
        timeout(limit, open_session(&config))
            .await
            .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "connect timed out"))?
    })
    .await;
}

async fn open_session(config: &RabbitMqConfig) -> io::Result<RabbitSession<'_>> {
    let arguments = OpenConnectionArguments::try_from(config.url.as_str())
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;
    let connection = Connection::open(&arguments)
        .await
        .map_err(io::Error::other)?;
    let channel = connection
        .open_channel(None)
        .await
        .map_err(io::Error::other)?;
    let deliveries = prepare_topology(config, &channel)
        .await
        .map_err(io::Error::other)?;
    Ok(RabbitSession {
        config,
        connection,
        channel,
        deliveries,
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
    fn display_target_hides_credentials() {
        let mut config = RabbitMqConfig::new("amqp://user:secret@broker:5672/vhost".into());
        assert_eq!(config.display_target(), "broker:5672/vhost");
        config.queue = Some("orders".into());
        assert_eq!(config.display_target(), "broker:5672/vhost · orders");
    }
}
