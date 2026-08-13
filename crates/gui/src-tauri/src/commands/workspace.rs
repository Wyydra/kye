use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use shell_desktop::DesktopSystemShell;
use storage_sqlite::{SqlarAssetRepository, SqliteConnection, SqliteGraphRepository};

use crate::backend::{DynamicAssetRepository, DynamicGraphRepository, DynamicKindRepository};
use crate::dto::{GraphDto, WorkspaceMetaDto, WorkspaceStatusDto};
use crate::error::{AppError, AppResult};
use crate::state::{AppService, AppState, TauriEventBus};

pub fn open_workspace_service(
    uri_or_path: &str,
    app_handle: tauri::AppHandle,
) -> AppResult<(AppService, PathBuf)> {
    tracing::info!("Opening workspace: '{}'", uri_or_path);

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
    let conn = SqliteConnection::open(&path).map_err(|e| {
        tracing::error!("Failed to open SQLite database '{}': {}", path.display(), e);
        AppError::Internal(format!("Failed to open SQLite database: {:?}", e))
    })?;

    let sqlite_repo = SqliteGraphRepository::new(conn.clone());

    use domain::ports::GraphRepository;
    use domain::workspace::WorkspaceMeta;

    // Auto-bootstrap workspace metadata for newly created databases
    if sqlite_repo.load_meta().is_err() {
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Workspace");
        tracing::info!("Initializing new workspace: '{}'", name);
        let default_meta = WorkspaceMeta::new(uuid::Uuid::new_v4(), name);
        if let Err(e) = sqlite_repo.save_meta(&default_meta) {
            tracing::error!("Failed to bootstrap workspace metadata: {}", e);
        }
    }

    tracing::info!("Workspace ready: '{}'", path.display());

    let graph_repo = DynamicGraphRepository::Sqlite(sqlite_repo.clone());
    let kind_repo = DynamicKindRepository::Sqlite(sqlite_repo);
    let asset_repo = DynamicAssetRepository::Sqlite(SqlarAssetRepository::new(conn));

    // Desktop shell integration
    let parent_dir = path.parent().unwrap_or(&path).to_path_buf();
    let shell = DesktopSystemShell::new(parent_dir);

    let service = Arc::new(Service::new(
        graph_repo, kind_repo, event_bus, asset_repo, shell,
    ));

    Ok((service, path))
}

#[tauri::command]
pub fn get_workspace_status(state: tauri::State<'_, AppState>) -> WorkspaceStatusDto {
    state.with_inner(|inner| WorkspaceStatusDto {
        is_selected: inner.service.is_some() && inner.workspace_path.is_some(),
        path: inner
            .workspace_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
    })
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
    let target_uri = {
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
            let dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|_| AppError::Internal("Failed to access app_data_dir".into()))?;
            let _ = std::fs::create_dir_all(&dir);
            dir.join("workspace.kye").to_string_lossy().to_string()
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

    Ok(Some(target_uri))
}

#[tauri::command]
pub async fn list_workspaces(_app_handle: tauri::AppHandle) -> AppResult<Vec<String>> {
    Ok(vec![])
}

#[tauri::command]
pub async fn create_workspace(name: String, app_handle: tauri::AppHandle) -> AppResult<String> {
    let target_uri = if name.ends_with(".kye") || name.ends_with(".db") || name.ends_with(".sqlite")
    {
        name
    } else {
        format!("{}.kye", name)
    };

    let _ = open_workspace_service(&target_uri, app_handle)?;
    Ok(target_uri)
}
