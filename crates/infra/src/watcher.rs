use domain::ports::ExternalEventHandler;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;

pub struct FSWatcher<H: ExternalEventHandler> {
    path: PathBuf,
    handler: H,
}

impl<H: ExternalEventHandler> FSWatcher<H> {
    pub fn new(path: PathBuf, handler: H) -> Self {
        Self { path, handler }
    }

    pub fn watch(&self) {
        let path = self.path.clone();
        let handler = self.handler.clone();

        std::thread::spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel();

            let mut watcher = RecommendedWatcher::new(tx, Config::default())
                .expect("Failed to create watcher");

            watcher
                .watch(&path, RecursiveMode::Recursive)
                .expect("Failed to watch path");

            loop {
                match rx.recv() {
                    Ok(Ok(event)) => {
                        if matches!(
                            event.kind,
                            notify::EventKind::Modify(_)
                                | notify::EventKind::Create(_)
                                | notify::EventKind::Remove(_)
                        ) {
                            while rx.recv_timeout(Duration::from_millis(300)).is_ok() {
                            }
                            handler.on_workspace_file_changed();
                        }
                    }
                    Ok(Err(e)) => tracing::error!("watch error: {:?}", e),
                    Err(_) => break,
                }
            }
        });
    }
}
