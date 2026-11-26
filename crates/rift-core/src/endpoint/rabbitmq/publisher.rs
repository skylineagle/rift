use std::collections::BTreeMap;

use amqprs::callbacks::ChannelCallback;
use amqprs::channel::Channel;
use amqprs::{Ack, BasicProperties, Cancel, CloseChannel, FieldName, FieldTable, FieldValue};
use amqprs::{Nack, Return};
use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::endpoint::link::WriteRequest;

const SEQUENCE_HEADER: &str = "x-rift-publish-sequence";
const MAXIMUM_UNCONFIRMED: usize = 256;

pub(super) enum BrokerSignal {
    Confirmed {
        sequence: u64,
        multiple: bool,
        accepted: bool,
    },
    Returned {
        sequence: u64,
        reason: String,
    },
    ChannelClosed {
        reason: String,
    },
}

pub(super) struct BrokerCallbacks(mpsc::UnboundedSender<BrokerSignal>);

impl BrokerCallbacks {
    pub fn channel() -> (Self, mpsc::UnboundedReceiver<BrokerSignal>) {
        let (sender, signals) = mpsc::unbounded_channel();
        (Self(sender), signals)
    }

    fn signal(&self, signal: BrokerSignal) {
        let _ = self.0.send(signal);
    }
}

#[async_trait]
impl ChannelCallback for BrokerCallbacks {
    async fn close(
        &mut self,
        _channel: &Channel,
        close: CloseChannel,
    ) -> Result<(), amqprs::error::Error> {
        self.signal(BrokerSignal::ChannelClosed {
            reason: format!("{} {}", close.reply_code(), close.reply_text()),
        });
        Ok(())
    }

    async fn cancel(
        &mut self,
        _channel: &Channel,
        _cancel: Cancel,
    ) -> Result<(), amqprs::error::Error> {
        Ok(())
    }

    async fn flow(
        &mut self,
        _channel: &Channel,
        active: bool,
    ) -> Result<bool, amqprs::error::Error> {
        Ok(active)
    }

    async fn publish_ack(&mut self, _channel: &Channel, ack: Ack) {
        self.signal(BrokerSignal::Confirmed {
            sequence: ack.delivery_tag(),
            multiple: ack.mutiple(),
            accepted: true,
        });
    }

    async fn publish_nack(&mut self, _channel: &Channel, nack: Nack) {
        self.signal(BrokerSignal::Confirmed {
            sequence: nack.delivery_tag(),
            multiple: nack.multiple(),
            accepted: false,
        });
    }

    async fn publish_return(
        &mut self,
        _channel: &Channel,
        returned: Return,
        properties: BasicProperties,
        _content: Vec<u8>,
    ) {
        if let Some(sequence) = sequence_of(&properties) {
            self.signal(BrokerSignal::Returned {
                sequence,
                reason: format!(
                    "broker returned the message: {} {}",
                    returned.reply_code(),
                    returned.reply_text()
                ),
            });
        }
    }
}

fn sequence_header() -> FieldName {
    SEQUENCE_HEADER.try_into().expect("short header name")
}

fn sequence_of(properties: &BasicProperties) -> Option<u64> {
    match properties.headers()?.get(&sequence_header())? {
        FieldValue::l(sequence) => u64::try_from(*sequence).ok(),
        _ => None,
    }
}

#[derive(Default)]
pub(super) struct Outbox {
    published: u64,
    unconfirmed: BTreeMap<u64, WriteRequest>,
}

impl Outbox {
    pub fn is_full(&self) -> bool {
        self.unconfirmed.len() >= MAXIMUM_UNCONFIRMED
    }

    pub fn track(&mut self, request: WriteRequest, properties: &mut BasicProperties) {
        self.published += 1;
        let mut headers = FieldTable::new();
        headers.insert(sequence_header(), FieldValue::l(self.published as i64));
        properties.with_headers(headers);
        self.unconfirmed.insert(self.published, request);
    }

    pub fn take(&mut self, sequence: u64) -> Option<WriteRequest> {
        self.unconfirmed.remove(&sequence)
    }

    pub fn take_confirmed(&mut self, sequence: u64, multiple: bool) -> Vec<WriteRequest> {
        if !multiple {
            return self.take(sequence).into_iter().collect();
        }
        let later = self.unconfirmed.split_off(&(sequence + 1));
        std::mem::replace(&mut self.unconfirmed, later)
            .into_values()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use bytes::Bytes;

    use super::*;
    use crate::event::{Event, Origin};
    use crate::outlet::Outlet;
    use crate::side::Side;

    fn request(text: &'static str) -> WriteRequest {
        let bytes = Bytes::from_static(text.as_bytes());
        let event = Event::data("test", Side::A, Side::B, Origin::Injected, &bytes, true);
        WriteRequest::new(bytes, event, Arc::new(Outlet::detached(8)))
    }

    #[test]
    fn confirms_settle_the_published_sequence() {
        let mut outbox = Outbox::default();
        let mut properties = BasicProperties::default();
        for text in ["one", "two", "three", "four"] {
            outbox.track(request(text), &mut properties);
        }
        assert_eq!(sequence_of(&properties), Some(4));
        assert_eq!(outbox.take(3).unwrap().bytes.as_ref(), b"three");
        let confirmed: Vec<Bytes> = outbox
            .take_confirmed(2, true)
            .into_iter()
            .map(|request| request.bytes)
            .collect();
        assert_eq!(confirmed, ["one", "two"]);
        assert!(outbox.take_confirmed(3, false).is_empty());
        assert_eq!(outbox.take_confirmed(4, false).len(), 1);
    }
}
