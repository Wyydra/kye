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
use infra::media::FileAssetRepository;

use crate::dto::{GraphDto, WorkspaceMetaDto};

use crate::error::{AppError, AppResult};
use crate::state::{AppState, TauriEventBus};

fn get_kye_base_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .document_dir()
        .map(|p| p.join("Kye"))
        .unwrap_or_else(|_| PathBuf::from("Kye"))
}

#[tauri::command]
pub fn get_workspace_path(state: tauri::State<'_, AppState>) -> Option<String> {
    state.with_inner(|inner| {
        inner
            .workspace_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn get_meta(state: tauri::State<'_, AppState>) -> AppResult<WorkspaceMetaDto> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let meta = service.get_meta()?;
    Ok(WorkspaceMetaDto::from(&meta))
}

#[tauri::command]
pub fn get_graph(state: tauri::State<'_, AppState>) -> AppResult<GraphDto> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let graph = service.load_graph()?;
    Ok(GraphDto::from(&graph))
}

#[tauri::command]
pub async fn select_workspace_folder(
    path: Option<String>,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Option<String>> {
    let path: PathBuf = match path {
        Some(p) => {
            if !p.contains('/') && !p.contains('\\') {
                get_kye_base_dir(&app_handle).join(p)
            } else {
                PathBuf::from(p)
            }
        }
        None => {
            #[cfg(desktop)]
            {
                let (tx, rx) = tokio::sync::oneshot::channel();
                app_handle.dialog().file().pick_folder(move |picked| {
                    let _ = tx.send(picked);
                });

                let picked = rx
                    .await
                    .map_err(|_| AppError::Internal("Dialog channel closed".into()))?;
                match picked {
                    Some(p) => p
                        .into_path()
                        .map_err(|_| AppError::Internal("Invalid path".into()))?,
                    None => return Ok(None),
                }
            }
            #[cfg(mobile)]
            {
                return Err(AppError::Internal(
                    "No path provided for mobile workspace".into(),
                ));
            }
        }
    };

    let settings_path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json");
    let store = StoreBuilder::new(&app_handle, settings_path)
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let _ = store.set(
        "workspace_path",
        serde_json::json!(path.to_string_lossy().to_string()),
    );
    let _ = store.save();

    let fs = WorkspaceFs::new(path.clone());
    fs.init()
        .map_err(|e| AppError::Internal(format!("Failed to init FS: {:?}", e)))?;

    let graph_repo = InMemoryGraphRepository::load(fs.clone())
        .map_err(|e| AppError::Internal(format!("Failed to load graph: {:?}", e)))?;
    let kind_repo = FileKindRepository::new(fs.clone());
    let asset_repo = FileAssetRepository::new(fs);
    let event_bus = TauriEventBus {
        app_handle: app_handle.clone(),
    };

    let service = Arc::new(Service::new(graph_repo, kind_repo, event_bus, asset_repo));

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(path.clone());
    });

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn list_workspaces(app_handle: tauri::AppHandle) -> AppResult<Vec<String>> {
    let base_path = get_kye_base_dir(&app_handle);
    if !base_path.exists() {
        return Ok(vec![]);
    }

    let mut workspaces = vec![];
    if let Ok(entries) = std::fs::read_dir(base_path) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    if !name.starts_with('.') {
                        workspaces.push(name.to_string());
                    }
                }
            }
        }
    }

    workspaces.sort();
    Ok(workspaces)
}

#[tauri::command]
pub async fn create_workspace(name: String, app_handle: tauri::AppHandle) -> AppResult<String> {
    let new_path = get_kye_base_dir(&app_handle).join(&name);

    if !new_path.exists() {
        std::fs::create_dir_all(&new_path)
            .map_err(|e| AppError::Internal(format!("Failed to create workspace: {}", e)))?;
    }

    Ok(new_path.to_string_lossy().to_string())
}
