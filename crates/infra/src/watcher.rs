use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::mpsc::channel;
use std::thread;

pub struct FSWatcher {
    path: PathBuf,
}

impl FSWatcher {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn watch<F>(&self, on_change: F) 
    where 
        F: Fn() + Send + Sync + 'static 
    {
        let path = self.path.clone();
        
        thread::spawn(move || {
            let (tx, rx) = channel();
            let mut watcher = notify::recommended_watcher(tx).unwrap();
            watcher.watch(&path, RecursiveMode::Recursive).unwrap();

            for res in rx {
                match res {
                    Ok(Event { kind: EventKind::Modify(_), .. }) => {
                        on_change();
                    },
                    _ => {}
                }
            }
        });
    }
}
