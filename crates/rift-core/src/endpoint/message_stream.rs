use std::io;

use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio_tungstenite::tungstenite::{self, Message};
use tokio_tungstenite::WebSocketStream;

use super::link::{Context, WriteSource};
use super::message_format::MessageFormat;

pub(crate) async fn pump_messages<S, W>(
    socket: WebSocketStream<S>,
    format: &MessageFormat,
    context: &Context,
    writes: &mut W,
) -> io::Result<()>
where
    S: AsyncRead + AsyncWrite + Unpin,
    W: WriteSource,
{
    let (mut sender, mut receiver) = socket.split();
    loop {
        tokio::select! {
            _ = context.cancel.cancelled() => {
                let _ = sender.send(Message::Close(None)).await;
                return Ok(());
            }
            incoming = receiver.next() => match incoming {
                None | Some(Ok(Message::Close(_))) => return Ok(()),
                Some(Err(error)) => return Err(to_io(error)),
                Some(Ok(message)) => match format.decode(message) {
                    Ok(Some(bytes)) => {
                        if !context.forward(bytes).await {
                            return Ok(());
                        }
                    }
                    Ok(None) => {}
                    Err(reason) => context.report_error(reason).await,
                },
            },
            outgoing = writes.next() => match outgoing {
                Some(request) => match format.encode(&request.bytes) {
                    Ok(message) => {
                        sender.send(message).await.map_err(to_io)?;
                        request.delivered();
                    }
                    Err(reason) => context.report_error(reason).await,
                },
                None => return Ok(()),
            },
        }
    }
}

pub(crate) fn to_io(error: tungstenite::Error) -> io::Error {
    match error {
        tungstenite::Error::Io(error) => error,
        other => io::Error::other(other),
    }
}
