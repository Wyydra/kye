use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use domain::command::Event;
use domain::ports::EventBus;
use domain::service::Service;
use shell_desktop::DesktopSystemShell;
use sync_http::HttpSyncServer;

use crate::backend::{DynamicAssetRepository, DynamicGraphRepository, DynamicKindRepository};
use crate::dto::EventDto;

pub type AppService = Arc<
    Service<
        DynamicGraphRepository,
        DynamicKindRepository,
        TauriEventBus,
        DynamicAssetRepository,
        DesktopSystemShell,
    >,
>;

#[derive(Clone)]
pub struct TauriEventBus {
    pub app_handle: tauri::AppHandle,
}

impl EventBus for TauriEventBus {
    fn publish(&self, event: &Event) {
        let dto = EventDto::from(event);
        if let Err(e) = self.app_handle.emit("kye_event", dto) {
            tracing::error!("Failed to emit kye_event: {}", e);
        }
    }
}

pub struct AppState {
    inner: Arc<Mutex<AppStateInner>>,
}

pub struct AppStateInner {
    pub service: Option<AppService>,
    pub workspace_path: Option<PathBuf>,
    pub p2p_server: Option<HttpSyncServer>,
}

impl AppState {
    pub fn new(service: Option<AppService>, workspace_path: Option<PathBuf>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(AppStateInner {
                service,
                workspace_path,
                p2p_server: None,
            })),
        }
    }

    pub fn with_inner<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&mut AppStateInner) -> R,
    {
        let mut inner = self.inner.lock().unwrap();
        f(&mut inner)
    }

    pub fn service(&self) -> Option<AppService> {
        self.with_inner(|inner| inner.service.clone())
    }
}
