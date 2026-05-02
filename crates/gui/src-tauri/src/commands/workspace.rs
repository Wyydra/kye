use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;

use domain::ports::WorkspaceUseCase;
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;

use crate::state::{AppState, TauriEventDispatcher};
use crate::dto::WorkspaceDto;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn get_workspace(state: tauri::State<'_, AppState>) -> AppResult<WorkspaceDto> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    let workspace = service.get_workspace().await?;
    Ok(WorkspaceDto::from_domain(&workspace, &service))
}

#[tauri::command]
pub fn get_workspace_path(state: tauri::State<'_, AppState>) -> String {
    state.with_inner(|inner| inner.workspace_path.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default())
}

#[tauri::command]
pub async fn select_workspace_folder(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<String> {
    let pick = app_handle.dialog().file().blocking_pick_folder();

    if let Some(picked) = pick {
        let path = picked.into_path().map_err(|_| "Invalid path".to_string())?;
        
        let settings_path = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
        let store = StoreBuilder::new(&app_handle, settings_path).build().map_err(|e| e.to_string())?;
        let _ = store.set("workspace_path", serde_json::json!(path.to_string_lossy().to_string()));
        let _ = store.save();

        let dispatcher = TauriEventDispatcher { app_handle: app_handle.clone() };
        let repo = DirectoryWorkspaceRepository::new(path.clone());
        let service = Arc::new(Service::new(repo, dispatcher));
        
        let watcher = FSWatcher::new(path.clone(), (*service).clone());
        
        state.with_inner(|inner| {
            inner.service = Some(service.clone());
            inner.workspace_path = Some(path.clone());
            // This implicitly drops the old watcher, stopping its thread!
            inner.watcher = Some(watcher);
        });

        Ok(path.to_string_lossy().to_string())
    } else {
        Err("No folder selected".to_string().into())
    }
}
