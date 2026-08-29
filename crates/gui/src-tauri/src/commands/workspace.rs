use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;

use domain::command::Command;
use domain::ports::{GraphRepository, SystemShellPort};
use domain::primitives::{Kind, NodeId, PropKey};
use domain::service::Service;
use domain::value::{Props, Value};
use domain::workspace::WorkspaceMeta;
use shell_desktop::DesktopSystemShell;
use storage_sqlite::{SqlarAssetRepository, SqliteConnection, SqliteGraphRepository};

use crate::backend::{DynamicAssetRepository, DynamicGraphRepository, DynamicKindRepository};
use crate::dto::{GraphDto, WorkspaceMetaDto, WorkspaceStatusDto};
use crate::error::{AppError, AppResult};
use crate::state::{AppService, AppState, TauriEventBus};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened: i64,
    pub is_pinned: bool,
    pub exists: bool,
}

pub fn get_settings_store(
    app_handle: &tauri::AppHandle,
) -> AppResult<Arc<tauri_plugin_store::Store<tauri::Wry>>> {
    let settings_path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("settings.json");

    StoreBuilder::new(app_handle, settings_path)
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn record_workspace_opened(
    app_handle: &tauri::AppHandle,
    resolved_path: &Path,
    workspace_name: Option<&str>,
) -> AppResult<()> {
    let store = get_settings_store(app_handle)?;
    let _ = store.reload();

    let path_str = resolved_path.to_string_lossy().to_string();
    let name = match workspace_name {
        Some(n) if !n.trim().is_empty() && n.trim() != "Workspace" => n.trim().to_string(),
        _ => {
            let stem = resolved_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Workspace");
            if stem.eq_ignore_ascii_case("workspace") {
                resolved_path
                    .parent()
                    .and_then(|p| p.file_name())
                    .and_then(|s| s.to_str())
                    .unwrap_or("Workspace")
                    .to_string()
            } else {
                stem.to_string()
            }
        }
    };

    let mut recents: Vec<RecentWorkspace> = store
        .get("recent_workspaces")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let now = chrono::Utc::now().timestamp_millis();

    if let Some(existing) = recents.iter_mut().find(|r| r.path == path_str) {
        existing.last_opened = now;
        existing.exists = true;
        if !name.is_empty() && (existing.name == "Workspace" || existing.name != name) {
            existing.name = name;
        }
    } else {
        recents.push(RecentWorkspace {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: path_str.clone(),
            last_opened: now,
            is_pinned: false,
            exists: true,
        });
    }

    // Sort: pinned first, then by last_opened descending
    recents.sort_by(|a, b| {
        b.is_pinned
            .cmp(&a.is_pinned)
            .then_with(|| b.last_opened.cmp(&a.last_opened))
    });

    // Keep up to 30 recents
    if recents.len() > 30 {
        recents.truncate(30);
    }

    store.set(
        "recent_workspaces",
        serde_json::to_value(&recents).map_err(|e| AppError::Internal(e.to_string()))?,
    );
    store.set("workspace_path", serde_json::json!(path_str));
    let _ = store.save();

    Ok(())
}

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

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
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

    // Auto-bootstrap workspace metadata for newly created databases
    if sqlite_repo.load_meta().is_err() {
        let ws_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Workspace");
        tracing::info!("Initializing new workspace: '{}'", ws_name);
        let default_meta = WorkspaceMeta::new(uuid::Uuid::new_v4(), ws_name);
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

fn generate_template_commands(template: &str) -> Vec<Command> {
    match template {
        "knowledge" | "notes" => {
            let mut cmds = Vec::new();

            // 1. Welcome Note
            let welcome_id = NodeId::new();
            let mut p1 = Props::new();
            p1.insert(
                PropKey::from("title"),
                Value::Text("Welcome to Your Knowledge Base".into()),
            );
            p1.insert(PropKey::from("icon"), Value::Text("🧠".into()));
            p1.insert(
                PropKey::from("body"),
                Value::Text(
                    "# Welcome to Kye\n\nYour local-first networked knowledge base and infinite thinking canvas.\n\n### ⚡ Quick Navigation\n- Use the **Explorer** on the left to browse your documents.\n- Press **+ New** to create pages, tasks, databases, and canvases.\n- Switch between **Document View** and **Infinite Canvas Graph** anytime.\n- Connect thoughts seamlessly with references and custom schemas."
                        .into(),
                ),
            );
            cmds.push(Command::CreateNode {
                id: welcome_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 0,
                props: p1,
            });

            // 2. Daily Notes
            let daily_id = NodeId::new();
            let mut p2 = Props::new();
            p2.insert(
                PropKey::from("title"),
                Value::Text("Daily Notes & Journal".into()),
            );
            p2.insert(PropKey::from("icon"), Value::Text("📅".into()));
            p2.insert(
                PropKey::from("body"),
                Value::Text(
                    "Capture daily thoughts, meeting reflections, and quick ideas here.".into(),
                ),
            );
            cmds.push(Command::CreateNode {
                id: daily_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 1,
                props: p2,
            });

            // 3. Projects & Ideas
            let proj_id = NodeId::new();
            let mut p3 = Props::new();
            p3.insert(
                PropKey::from("title"),
                Value::Text("Projects & Roadmaps".into()),
            );
            p3.insert(PropKey::from("icon"), Value::Text("💡".into()));
            p3.insert(
                PropKey::from("body"),
                Value::Text("Track ongoing initiatives, projects, and active goals.".into()),
            );
            cmds.push(Command::CreateNode {
                id: proj_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 2,
                props: p3,
            });

            // 4. Resources
            let res_id = NodeId::new();
            let mut p4 = Props::new();
            p4.insert(
                PropKey::from("title"),
                Value::Text("Resources & References".into()),
            );
            p4.insert(PropKey::from("icon"), Value::Text("📚".into()));
            p4.insert(
                PropKey::from("body"),
                Value::Text(
                    "Curated articles, cheatsheets, reading list, and bookmarks.".into(),
                ),
            );
            cmds.push(Command::CreateNode {
                id: res_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 3,
                props: p4,
            });

            cmds
        }
        "tasks" | "project" => {
            let mut cmds = Vec::new();

            let dash_id = NodeId::new();
            let mut p1 = Props::new();
            p1.insert(
                PropKey::from("title"),
                Value::Text("Project Dashboard".into()),
            );
            p1.insert(PropKey::from("icon"), Value::Text("📋".into()));
            p1.insert(
                PropKey::from("body"),
                Value::Text(
                    "# Project Dashboard\nTrack tasks, milestones, and deliverables.".into(),
                ),
            );
            cmds.push(Command::CreateNode {
                id: dash_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 0,
                props: p1,
            });

            let tasks = [
                (
                    "Launch MVP Version",
                    "Ship initial workspace release with instant switching",
                    "in_progress",
                    "🚀",
                ),
                (
                    "Set up Workspace Architecture",
                    "Organize databases and custom kinds",
                    "done",
                    "📐",
                ),
                (
                    "User Testing & Feedback",
                    "Gather feedback on fast workspace opening",
                    "todo",
                    "💬",
                ),
                (
                    "Polish Themes & Layouts",
                    "Ensure high contrast and sleek minimalist visuals",
                    "todo",
                    "🎨",
                ),
            ];

            for (i, (title, body, status, icon)) in tasks.iter().enumerate() {
                let tid = NodeId::new();
                let mut tp = Props::new();
                tp.insert(PropKey::from("title"), Value::Text((*title).into()));
                tp.insert(PropKey::from("body"), Value::Text((*body).into()));
                tp.insert(PropKey::from("status"), Value::Text((*status).into()));
                tp.insert(PropKey::from("icon"), Value::Text((*icon).into()));
                cmds.push(Command::CreateNode {
                    id: tid,
                    kind: Kind::from("core.task"),
                    parent_id: None,
                    index: i + 1,
                    props: tp,
                });
            }

            cmds
        }
        "demo" => {
            let mut cmds = Vec::new();

            let tour_id = NodeId::new();
            let mut p1 = Props::new();
            p1.insert(
                PropKey::from("title"),
                Value::Text("Welcome to the Feature Tour".into()),
            );
            p1.insert(PropKey::from("icon"), Value::Text("✨".into()));
            p1.insert(
                PropKey::from("body"),
                Value::Text(
                    "# Welcome to Kye! 🚀\n\nExperience a powerful local-first workspace:\n\n1. **Dual Canvas & Document View**: Visualize interconnected notes or focus in distraction-free writing.\n2. **Type-Safe Schemas**: Define custom block types, properties, and relationships.\n3. **Local-First SQLite Engine**: Sub-millisecond queries, complete privacy and offline-first design.\n4. **Peer-to-Peer Sync**: Synchronize seamlessly between devices over local network.\n\n*Enjoy creating!*"
                        .into(),
                ),
            );
            cmds.push(Command::CreateNode {
                id: tour_id,
                kind: Kind::from("core.page"),
                parent_id: None,
                index: 0,
                props: p1,
            });

            let canvas_id = NodeId::new();
            let mut p2 = Props::new();
            p2.insert(
                PropKey::from("title"),
                Value::Text("Visual Canvas Board".into()),
            );
            p2.insert(PropKey::from("icon"), Value::Text("🎨".into()));
            cmds.push(Command::CreateNode {
                id: canvas_id,
                kind: Kind::from("core.canvas"),
                parent_id: None,
                index: 1,
                props: p2,
            });

            cmds
        }
        _ => Vec::new(),
    }
}

// -----------------------------------------------------------------------------
// Tauri Commands
// -----------------------------------------------------------------------------

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
pub fn get_default_workspace_dir(app_handle: tauri::AppHandle) -> AppResult<String> {
    let dir = app_handle
        .path()
        .document_dir()
        .or_else(|_| app_handle.path().home_dir())
        .or_else(|_| app_handle.path().app_data_dir())
        .map(|p| p.join("Kye"))
        .unwrap_or_else(|_| PathBuf::from("Kye"));

    let _ = std::fs::create_dir_all(&dir);
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn pick_workspace_directory(app_handle: tauri::AppHandle) -> AppResult<Option<String>> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app_handle.dialog().file().pick_folder(move |picked| {
        let _ = tx.send(picked);
    });

    let picked = rx
        .await
        .map_err(|_| AppError::Internal("Dialog channel closed".into()))?;

    match picked {
        Some(p) => Ok(Some(
            p.into_path()
                .map_err(|_| AppError::Internal("Invalid directory path".into()))?
                .to_string_lossy()
                .to_string(),
        )),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn pick_workspace_file(app_handle: tauri::AppHandle) -> AppResult<Option<String>> {
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
        Some(p) => Ok(Some(
            p.into_path()
                .map_err(|_| AppError::Internal("Invalid file path".into()))?
                .to_string_lossy()
                .to_string(),
        )),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn list_recent_workspaces(app_handle: tauri::AppHandle) -> AppResult<Vec<RecentWorkspace>> {
    let store = get_settings_store(&app_handle)?;
    let _ = store.reload();

    let mut recents: Vec<RecentWorkspace> = store
        .get("recent_workspaces")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    for item in &mut recents {
        item.exists = Path::new(&item.path).exists();
        if item.name.trim().is_empty() || item.name.eq_ignore_ascii_case("workspace") {
            let p = Path::new(&item.path);
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("Workspace");
            if stem.eq_ignore_ascii_case("workspace") {
                item.name = p
                    .parent()
                    .and_then(|parent| parent.file_name())
                    .and_then(|s| s.to_str())
                    .unwrap_or("Workspace")
                    .to_string();
            } else {
                item.name = stem.to_string();
            }
        }
    }

    recents.sort_by(|a, b| {
        b.is_pinned
            .cmp(&a.is_pinned)
            .then_with(|| b.last_opened.cmp(&a.last_opened))
    });

    Ok(recents)
}

#[tauri::command]
pub async fn open_workspace(
    path: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<RecentWorkspace> {
    let (service, resolved_path) = open_workspace_service(&path, app_handle.clone())?;

    let meta = service.get_meta()?;
    let name = meta.name.clone();

    record_workspace_opened(&app_handle, &resolved_path, Some(&name))?;

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(resolved_path.clone());
    });

    Ok(RecentWorkspace {
        id: meta.id.to_string(),
        name,
        path: resolved_path.to_string_lossy().to_string(),
        last_opened: chrono::Utc::now().timestamp_millis(),
        is_pinned: false,
        exists: true,
    })
}

#[tauri::command]
pub async fn create_workspace(
    name: String,
    directory: Option<String>,
    template: Option<String>,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<RecentWorkspace> {
    let raw_name = name.trim();
    let safe_name = if raw_name.is_empty() {
        "My Workspace"
    } else {
        raw_name
    };

    // Sanitize filename
    let file_stem = safe_name
        .replace('/', "-")
        .replace('\\', "-")
        .replace(':', "-")
        .replace('*', "-")
        .replace('?', "-")
        .replace('"', "-")
        .replace('<', "-")
        .replace('>', "-")
        .replace('|', "-");

    let base_dir = match directory {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d.trim()),
        _ => app_handle
            .path()
            .document_dir()
            .or_else(|_| app_handle.path().home_dir())
            .or_else(|_| app_handle.path().app_data_dir())
            .map(|p| p.join("Kye"))
            .unwrap_or_else(|_| PathBuf::from("Kye")),
    };

    let _ = std::fs::create_dir_all(&base_dir);

    // Compute unique file path if needed
    let mut file_path = base_dir.join(format!("{}.kye", file_stem));
    if file_path.exists() {
        let mut counter = 1;
        while file_path.exists() {
            file_path = base_dir.join(format!("{} ({}).kye", file_stem, counter));
            counter += 1;
        }
    }

    let target_uri = file_path.to_string_lossy().to_string();
    let (service, resolved_path) = open_workspace_service(&target_uri, app_handle.clone())?;

    // Update metadata name
    let default_meta = WorkspaceMeta::new(uuid::Uuid::new_v4(), safe_name);
    let _ = service.get_meta().map(|mut m| {
        m.name = safe_name.to_string();
    });

    // Populate starter template if specified
    if let Some(tpl) = template {
        let cmds = generate_template_commands(&tpl);
        if !cmds.is_empty() {
            let _ = service.execute_batch(cmds);
        }
    }

    record_workspace_opened(&app_handle, &resolved_path, Some(safe_name))?;

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(resolved_path.clone());
    });

    Ok(RecentWorkspace {
        id: default_meta.id.to_string(),
        name: safe_name.to_string(),
        path: resolved_path.to_string_lossy().to_string(),
        last_opened: chrono::Utc::now().timestamp_millis(),
        is_pinned: false,
        exists: true,
    })
}

#[tauri::command]
pub fn close_workspace(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    state.with_inner(|inner| {
        inner.service = None;
        inner.workspace_path = None;
    });

    if let Ok(store) = get_settings_store(&app_handle) {
        let _ = store.reload();
        store.delete("workspace_path");
        let _ = store.save();
    }

    Ok(())
}

#[tauri::command]
pub fn remove_recent_workspace(
    path: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<RecentWorkspace>> {
    let store = get_settings_store(&app_handle)?;
    let _ = store.reload();

    let mut recents: Vec<RecentWorkspace> = store
        .get("recent_workspaces")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    recents.retain(|r| r.path != path);

    store.set(
        "recent_workspaces",
        serde_json::to_value(&recents).map_err(|e| AppError::Internal(e.to_string()))?,
    );

    // If removing the currently open workspace, close it
    let is_current = state.with_inner(|inner| {
        inner
            .workspace_path
            .as_ref()
            .map(|p| p.to_string_lossy() == path)
            .unwrap_or(false)
    });

    if is_current {
        state.with_inner(|inner| {
            inner.service = None;
            inner.workspace_path = None;
        });
        store.delete("workspace_path");
    }

    let _ = store.save();

    for item in &mut recents {
        item.exists = Path::new(&item.path).exists();
    }

    Ok(recents)
}

#[tauri::command]
pub fn toggle_pin_recent_workspace(
    path: String,
    app_handle: tauri::AppHandle,
) -> AppResult<Vec<RecentWorkspace>> {
    let store = get_settings_store(&app_handle)?;
    let _ = store.reload();

    let mut recents: Vec<RecentWorkspace> = store
        .get("recent_workspaces")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(item) = recents.iter_mut().find(|r| r.path == path) {
        item.is_pinned = !item.is_pinned;
    }

    recents.sort_by(|a, b| {
        b.is_pinned
            .cmp(&a.is_pinned)
            .then_with(|| b.last_opened.cmp(&a.last_opened))
    });

    store.set(
        "recent_workspaces",
        serde_json::to_value(&recents).map_err(|e| AppError::Internal(e.to_string()))?,
    );
    let _ = store.save();

    for item in &mut recents {
        item.exists = Path::new(&item.path).exists();
    }

    Ok(recents)
}

#[tauri::command]
pub fn reveal_workspace_in_explorer(
    path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let target_path = match path {
        Some(p) => PathBuf::from(p),
        None => state
            .with_inner(|inner| inner.workspace_path.clone())
            .ok_or_else(|| AppError::Internal("No workspace path available".into()))?,
    };

    let parent_dir = target_path.parent().unwrap_or(&target_path).to_path_buf();
    let shell = DesktopSystemShell::new(parent_dir);
    shell
        .reveal_in_explorer(&target_path.to_string_lossy())
        .map_err(|e| AppError::Internal(format!("Failed to reveal file: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub fn set_workspace_name(
    name: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<WorkspaceMetaDto> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Internal("Workspace name cannot be empty".into()));
    }

    let mut meta = service.get_meta()?;
    meta.name = trimmed.to_string();

    if let Some(path) = state.with_inner(|inner| inner.workspace_path.clone()) {
        let _ = record_workspace_opened(&app_handle, &path, Some(trimmed));
    }

    Ok(WorkspaceMetaDto::from(&meta))
}

// -----------------------------------------------------------------------------
// Legacy dialog commands maintained for backward compatibility
// -----------------------------------------------------------------------------

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

    let meta_name = service.get_meta().map(|m| m.name).ok();
    let _ = record_workspace_opened(&app_handle, &resolved_path, meta_name.as_deref());

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
                .set_file_name("workspace.kye")
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
    let _ = record_workspace_opened(&app_handle, &resolved_path, None);

    state.with_inner(|inner| {
        inner.service = Some(service);
        inner.workspace_path = Some(resolved_path.clone());
    });

    Ok(Some(target_uri))
}
