use domain::ports::ExternalEventHandler;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;

pub struct FSWatcher {
    _watcher: RecommendedWatcher,
}

impl FSWatcher {
    pub fn new<H: ExternalEventHandler + Send + 'static>(path: PathBuf, handler: H) -> Self {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .expect("Failed to create watcher");

        if let Err(e) = watcher.watch(&path, RecursiveMode::Recursive) {
            tracing::warn!("Failed to watch path {:?}: {}", path, e);
        }

        std::thread::spawn(move || {
            loop {
                match rx.recv() {
                    Ok(Ok(event)) => {
                        if matches!(
                            event.kind,
                            notify::EventKind::Modify(_)
                                | notify::EventKind::Create(_)
                                | notify::EventKind::Remove(_)
                        ) {
                            while rx.recv_timeout(Duration::from_millis(300)).is_ok() {}
                            handler.on_workspace_file_changed();
                        }
                    }
                    Ok(Err(e)) => tracing::error!("watch error: {:?}", e),
                    Err(_) => {
                        tracing::info!("FSWatcher thread shutting down cleanly");
                        break;
                    }
                }
            }
        });

        Self { _watcher: watcher }
    }
}
