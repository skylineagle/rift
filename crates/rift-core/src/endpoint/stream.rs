use std::io;

use bytes::Bytes;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use super::link::{Context, WriteSource};

const BUFFER_SIZE: usize = 4096;

pub(crate) async fn pump<S, W>(stream: S, context: &Context, writes: &mut W) -> io::Result<()>
where
    S: AsyncRead + AsyncWrite,
    W: WriteSource,
{
    let (mut reader, mut writer) = tokio::io::split(stream);
    let mut buffer = vec![0u8; BUFFER_SIZE];
    loop {
        tokio::select! {
            _ = context.cancel.cancelled() => return Ok(()),
            read = reader.read(&mut buffer) => {
                let count = read?;
                if count == 0 || !context.forward(Bytes::copy_from_slice(&buffer[..count])).await {
                    return Ok(());
                }
            }
            outgoing = writes.next() => match outgoing {
                Some(request) => {
                    writer.write_all(&request.bytes).await?;
                    request.delivered();
                },
                None => return Ok(()),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::endpoint::link::WriteRequest;
    use crate::event::{Event, Origin};
    use crate::outlet::Outlet;
    use crate::peers::PeerCounter;
    use crate::side::Side;
    use std::sync::Arc;
    use tokio::sync::mpsc;
    use tokio_util::sync::CancellationToken;

    #[tokio::test]
    async fn failed_stream_write_never_emits_forwarded_success() {
        let outlet = Arc::new(Outlet::detached(8));
        let mut received = outlet.events.subscribe();
        let (reads, _reads) = mpsc::channel(8);
        let (states, _states) = mpsc::channel(8);
        let context = Context {
            reads,
            states,
            peers: PeerCounter::default(),
            cancel: CancellationToken::new(),
        };
        let (sender, mut writes) = mpsc::channel(8);
        let bytes = Bytes::from_static(b"failed");
        sender
            .send(WriteRequest::new(
                bytes.clone(),
                Event::data("test", Side::A, Side::B, Origin::Forwarded, &bytes, true),
                outlet.clone(),
            ))
            .await
            .unwrap();
        let (stream, peer) = tokio::io::duplex(8);
        drop(peer);
        let (reader, _reader_peer) = tokio::io::duplex(8);
        let stream = tokio::io::join(reader, stream);
        let error = pump(stream, &context, &mut writes).await.unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::BrokenPipe);
        assert!(received.try_recv().is_err());
    }
}
