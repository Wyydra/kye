use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use domain::ports::EventDispatcher;
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;

pub type AppService = Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>;

#[derive(Clone)]
pub struct TauriEventDispatcher {
    pub app_handle: tauri::AppHandle,
}

impl EventDispatcher for TauriEventDispatcher {
    fn dispatch_workspace_updated(&self) {
        if let Err(e) = self.app_handle.emit("workspace_updated", ()) {
            tracing::error!("Failed to emit workspace_updated event: {}", e);
        }
    }
}

pub struct AppState {
    inner: Arc<Mutex<AppStateInner>>,
}

pub struct AppStateInner {
    pub service: Option<AppService>,
    pub workspace_path: Option<PathBuf>,
    #[allow(dead_code)]
    pub watcher: Option<FSWatcher>,
}

impl AppState {
    pub fn new(service: Option<AppService>, workspace_path: Option<PathBuf>, watcher: Option<FSWatcher>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(AppStateInner {
                service,
                workspace_path,
                watcher,
            })),
        }
    }

    pub fn with_inner<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut AppStateInner) -> R,
    {
        let mut inner = self.inner.lock().unwrap();
        f(&mut *inner)
    }

    pub fn service(&self) -> Option<AppService> {
        self.with_inner(|inner| inner.service.clone())
    }
}
