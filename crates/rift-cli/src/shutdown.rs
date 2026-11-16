#[cfg(unix)]
pub async fn wait_for_shutdown() {
    use tokio::signal::unix::{signal, SignalKind};

    let mut terminate = signal(SignalKind::terminate()).expect("install SIGTERM handler");
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = terminate.recv() => {}
    }
}

#[cfg(not(unix))]
pub async fn wait_for_shutdown() {
    let _ = tokio::signal::ctrl_c().await;
}
