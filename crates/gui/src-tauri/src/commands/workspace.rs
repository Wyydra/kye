use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use infra::fs::WorkspaceFs;
use infra::graph::InMemoryGraphRepository;
use infra::kind::FileKindRepository;

use crate::dto::{GraphDto, WorkspaceMetaDto};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, TauriEventBus};

#[tauri::command]
pub fn get_workspace_path(state: tauri::State<'_, AppState>) -> Option<String> {
    state.with_inner(|inner| inner.workspace_path.as_ref().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn get_meta(state: tauri::State<'_, AppState>) -> AppResult<WorkspaceMetaDto> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let meta = service.get_meta()?;
    Ok(WorkspaceMetaDto::from(&meta))
}

#[tauri::command]
pub fn get_graph(state: tauri::State<'_, AppState>) -> AppResult<GraphDto> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let graph = service.load_graph()?;
    Ok(GraphDto::from(&graph))
}

#[tauri::command]
pub async fn select_workspace_folder(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Option<String>> {
    tracing::info!("Command select_workspace_folder called");
    let path: PathBuf = {
        #[cfg(desktop)]
        {
            tracing::info!("Opening dialog...");
            let (tx, rx) = tokio::sync::oneshot::channel();
            app_handle.dialog().file().pick_folder(move |picked| {
                let _ = tx.send(picked);
            });
            
            let picked = rx.await.map_err(|_| AppError::Internal("Dialog channel closed".into()))?;
            tracing::info!("Dialog picked: {:?}", picked);
            match picked {
                Some(p) => p.into_path().map_err(|_| AppError::Internal("Invalid path".into()))?,
                None => return Ok(None),
            }
        }
        #[cfg(mobile)]
        {
            // Note: Mobile support is stubbed for now based on previous codebase
            return Err(AppError::Internal("Mobile folder picker not yet re-implemented in v4".into()));
        }
    };

    // Save to store
    let settings_path = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
    let store = StoreBuilder::new(&app_handle, settings_path).build().map_err(|e| AppError::Internal(e.to_string()))?;
    let _ = store.set("workspace_path", serde_json::json!(path.to_string_lossy().to_string()));
    let _ = store.save();

    // Initialize adapters
    let fs = WorkspaceFs::new(path.clone());
    if let Err(e) = fs.init() {
        tracing::error!("Failed to init FS: {:?}", e);
        return Err(AppError::Internal(format!("Failed to init FS: {:?}", e)));
    }
    
    let graph_repo = InMemoryGraphRepository::load(fs.clone())
        .map_err(|e| AppError::Internal(format!("Failed to load graph: {:?}", e)))?;
    let kind_repo = FileKindRepository::new(fs);
    let event_bus = TauriEventBus { app_handle: app_handle.clone() };

    let service = Arc::new(Service::new(graph_repo, kind_repo, event_bus));

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(path.clone());
    });

    Ok(Some(path.to_string_lossy().to_string()))
}
