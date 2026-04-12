use domain::ports::{BlockService, WorkspaceWatcher};
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::time::Duration;

pub struct FSWatcher<S: BlockService> {
    path: PathBuf,
    service: S,
}

impl<S: BlockService> FSWatcher<S> {
    pub fn new(path: PathBuf, service: S) -> Self {
        Self { path, service }
    }
}

impl<S: BlockService> WorkspaceWatcher for FSWatcher<S> {
    fn watch(&self) {
        let path = self.path.clone();
        let service = self.service.clone();
        
        std::thread::spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel();
            
            let mut watcher = RecommendedWatcher::new(tx, Config::default())
                .expect("Failed to create watcher");
                
            watcher.watch(&path, RecursiveMode::Recursive)
                .expect("Failed to watch path");
                
            loop {
                match rx.recv() {
                    Ok(Ok(event)) => {
                        if matches!(event.kind, notify::EventKind::Modify(_)) {
                            // Debounce: Wait for 100ms of silence
                            while rx.recv_timeout(Duration::from_millis(100)).is_ok() {
                                // Drain chatty events
                            }
                            service.notify_external_update();
                        }
                    }
                    Ok(Err(e)) => tracing::error!("watch error: {:?}", e),
                    Err(_) => break, // Channel closed
                }
            }
        });
    }
}
