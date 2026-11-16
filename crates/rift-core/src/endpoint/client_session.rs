use std::future::Future;
use std::io;
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncWrite};

use super::backoff::Backoff;
use super::link::{Context, Link};
use super::stream::pump;
use crate::event::ConnectionState;

pub(crate) async fn run_client<S, Connect, Connecting>(
    peer: String,
    link: Link,
    reconnect_delay: Duration,
    connect: Connect,
) where
    S: AsyncRead + AsyncWrite,
    Connect: Fn() -> Connecting,
    Connecting: Future<Output = io::Result<S>>,
{
    let Link {
        mut writes,
        context,
    } = link;
    let mut backoff = Backoff::new(reconnect_delay);
    while !context.cancel.is_cancelled() {
        context.report(ConnectionState::Connecting).await;
        let connected = tokio::select! {
            _ = context.cancel.cancelled() => break,
            result = connect() => result,
        };
        match connected {
            Ok(stream) => {
                backoff.reset();
                context.peers.joined();
                context
                    .report(ConnectionState::Connected { peer: peer.clone() })
                    .await;
                let result = pump(stream, &context, &mut writes).await;
                context.peers.left();
                report_end(&context, result).await;
                while writes.try_recv().is_ok() {}
            }
            Err(error) => context.report_error(error).await,
        }
        tokio::select! {
            _ = context.cancel.cancelled() => break,
            _ = tokio::time::sleep(backoff.next_delay()) => {}
        }
    }
}

async fn report_end(context: &Context, result: io::Result<()>) {
    if let Err(error) = result {
        context.report_error(error).await;
    }
    context
        .report(ConnectionState::Disconnected { peer: None })
        .await;
}
