use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use shell_desktop::DesktopSystemShell;
use storage_fs::WorkspaceFs;
use storage_sqlite::{SqlarAssetRepository, SqliteConnection, SqliteGraphRepository};

use crate::backend::{DynamicAssetRepository, DynamicGraphRepository, DynamicKindRepository};
use crate::dto::{GraphDto, WorkspaceMetaDto};
use crate::error::{AppError, AppResult};
use crate::state::{AppState, AppService, TauriEventBus};

pub fn open_workspace_service(
    uri_or_path: &str,
    app_handle: tauri::AppHandle,
) -> AppResult<(AppService, PathBuf)> {
    let clean_path_str = uri_or_path
        .strip_prefix("sqlite://")
        .or_else(|| uri_or_path.strip_prefix("file://"))
        .or_else(|| uri_or_path.strip_prefix("fs://"))
        .unwrap_or(uri_or_path);

    let mut path = PathBuf::from(clean_path_str);

    // If path is a folder (or doesn't have a db extension), place workspace.kye inside it
    if path.is_dir() || path.extension().is_none() {
        if !path.exists() {
            let _ = std::fs::create_dir_all(&path);
        }
        path = path.join("workspace.kye");
    }

    let event_bus = TauriEventBus {
        app_handle: app_handle.clone(),
    };

    // Open SQLite database
    let conn = SqliteConnection::open(&path)
        .map_err(|e| AppError::Internal(format!("Failed to open SQLite database: {:?}", e)))?;

    let sqlite_repo = SqliteGraphRepository::new(conn.clone());
    let graph_repo = DynamicGraphRepository::Sqlite(sqlite_repo.clone());
    let kind_repo = DynamicKindRepository::Sqlite(sqlite_repo);
    let asset_repo = DynamicAssetRepository::Sqlite(SqlarAssetRepository::new(conn));

    // Desktop shell integration
    let parent_dir = path.parent().unwrap_or(&path).to_path_buf();
    let fs_workspace = WorkspaceFs::new(parent_dir);
    let shell = DesktopSystemShell::new(fs_workspace);

    let service = Arc::new(Service::new(
        graph_repo, kind_repo, event_bus, asset_repo, shell,
    ));

    Ok((service, path))
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
    let target_uri: String = match path {
        Some(p) => p,
        None => {
            #[cfg(desktop)]
            {
                let (tx, rx) = tokio::sync::oneshot::channel();
                app_handle
                    .dialog()
                    .file()
                    .add_filter("Kye Workspace Database", &["kye", "db", "sqlite"])
                    .pick_file(move |picked| {
                        let _ = tx.send(picked);
                    });

                let picked = rx
                    .await
                    .map_err(|_| AppError::Internal("Dialog channel closed".into()))?;
                match picked {
                    Some(p) => p
                        .into_path()
                        .map_err(|_| AppError::Internal("Invalid path".into()))?
                        .to_string_lossy()
                        .to_string(),
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

    let (service, resolved_path) = open_workspace_service(&target_uri, app_handle.clone())?;

    let settings_path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json");
    let store = StoreBuilder::new(&app_handle, settings_path)
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    store.set("workspace_path", serde_json::json!(target_uri));
    let _ = store.save();

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(resolved_path.clone());
    });

    Ok(Some(resolved_path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn create_workspace_file(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Option<String>> {
    #[cfg(desktop)]
    {
        let (tx, rx) = tokio::sync::oneshot::channel();
        app_handle
            .dialog()
            .file()
            .add_filter("Kye Workspace Database", &["kye"])
            .set_file_name("mon_workspace.kye")
            .save_file(move |picked| {
                let _ = tx.send(picked);
            });

        let picked = rx
            .await
            .map_err(|_| AppError::Internal("Dialog channel closed".into()))?;
        let path = match picked {
            Some(p) => p
                .into_path()
                .map_err(|_| AppError::Internal("Invalid path".into()))?,
            None => return Ok(None),
        };

        let target_uri = path.to_string_lossy().to_string();
        let (service, resolved_path) = open_workspace_service(&target_uri, app_handle.clone())?;

        let settings_path = app_handle
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("settings.json");
        let store = StoreBuilder::new(&app_handle, settings_path)
            .build()
            .map_err(|e| AppError::Internal(e.to_string()))?;
        store.set("workspace_path", serde_json::json!(target_uri));
        let _ = store.save();

        state.with_inner(|inner| {
            inner.service = Some(service);
            inner.workspace_path = Some(resolved_path.clone());
        });

        Ok(Some(target_uri))
    }
    #[cfg(mobile)]
    {
        Err(AppError::Internal("Mobile save dialog not supported".into()))
    }
}

#[tauri::command]
pub async fn list_workspaces(_app_handle: tauri::AppHandle) -> AppResult<Vec<String>> {
    Ok(vec![])
}

#[tauri::command]
pub async fn create_workspace(name: String, app_handle: tauri::AppHandle) -> AppResult<String> {
    let target_uri = if name.ends_with(".kye") || name.ends_with(".db") || name.ends_with(".sqlite") {
        name
    } else {
        format!("{}.kye", name)
    };

    let _ = open_workspace_service(&target_uri, app_handle)?;
    Ok(target_uri)
}
