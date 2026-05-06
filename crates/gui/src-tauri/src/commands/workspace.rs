use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
#[allow(unused_imports)]
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;
use serde::Deserialize;

use domain::ports::WorkspaceUseCase;
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;

use crate::state::{AppState, TauriEventDispatcher};
use crate::dto::WorkspaceDto;
use crate::error::{AppError, AppResult};

#[derive(Deserialize)]
pub struct FolderPickResult {
    pub path: Option<String>,
    pub uri: String,
}

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
    // Resolve the workspace path from the dialog.
    // - Desktop: use blocking_pick_folder (folder picker, desktop-only API).
    // - Android: no folder picker exists; use a custom mobile plugin to call SAF.
    let path: PathBuf = {
        #[cfg(desktop)]
        {
            let picked = app_handle
                .dialog()
                .file()
                .blocking_pick_folder();
            let file_path = picked.ok_or_else(|| AppError::from("No folder selected".to_string()))?;
            file_path.into_path().map_err(|_| AppError::from("Invalid path".to_string()))?
        }
        #[cfg(mobile)]
        {
            use crate::folder_picker::FolderPicker;

            // Call our custom FolderPickerPlugin (ACTION_OPEN_DOCUMENT_TREE)
            let folder_picker = app_handle.state::<FolderPicker<tauri::Wry>>();
            let result = folder_picker
                .pick_folder()
                .map_err(|e| AppError::from(format!("Folder picker failed: {e}")))?;

            if let Some(path_str) = result.path {
                PathBuf::from(path_str)
            } else {
                return Err(AppError::from(format!(
                    "Unsupported storage location: {}. Please select a folder in your internal storage (Primary Storage).",
                    result.uri
                )));
            }
        }
    };

    let settings_path = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
    let store = StoreBuilder::new(&app_handle, settings_path).build().map_err(|e| e.to_string())?;
    let _ = store.set("workspace_path", serde_json::json!(path.to_string_lossy().to_string()));
    let _ = store.save();

    let dispatcher = TauriEventDispatcher { app_handle: app_handle.clone() };
    let repo = DirectoryWorkspaceRepository::new(path.clone());
    let service = Arc::new(Service::new(repo.clone(), repo, dispatcher));

    let watcher = FSWatcher::new(path.clone(), (*service).clone());

    state.with_inner(|inner| {
        inner.service = Some(service.clone());
        inner.workspace_path = Some(path.clone());
        // This implicitly drops the old watcher, stopping its thread!
        inner.watcher = Some(watcher);
    });

    Ok(path.to_string_lossy().to_string())
}
