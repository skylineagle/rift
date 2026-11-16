use rift_core::Event;
use tokio::sync::broadcast::{error::RecvError, Receiver};

use crate::arguments::OutputArguments;
use crate::render::render;

pub async fn print_events(mut events: Receiver<Event>, output: OutputArguments) {
    loop {
        match events.recv().await {
            Ok(event) => {
                if let Some(line) = render(&event, output.log, output.quiet) {
                    println!("{line}");
                }
            }
            Err(RecvError::Lagged(_)) => continue,
            Err(RecvError::Closed) => return,
        }
    }
}
