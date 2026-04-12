// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use domain::models::block::{Content, CreateBlockRequest, UpdateBlockRequest, Metadata};
use domain::ports::{BlockService, EventDispatcher};
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;
use tauri::{AppHandle, Manager};
use tauri::Emitter;


#[derive(Clone)]
pub struct TauriEventDispatcher {
    app_handle: AppHandle,
}

impl EventDispatcher for TauriEventDispatcher {
    fn dispatch_workspace_updated(&self) {
        if let Err(e) = self.app_handle.emit("workspace_updated", ()) {
            eprintln!("Failed to emit workspace_updated event: {}", e);
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceDto {
    pub name: String,
    pub blocks: Vec<BlockDto>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockDto {
    pub id: Uuid,
    pub content: String,
    pub metadata: String,
}

impl From<&domain::models::workspace::Workspace> for WorkspaceDto {
    fn from(w: &domain::models::workspace::Workspace) -> Self {
        Self {
            name: w.name().to_string(),
            blocks: w.blocks().iter().map(|b| b.into()).collect(),
        }
    }
}

impl From<&domain::models::block::Block> for BlockDto {
    fn from(b: &domain::models::block::Block) -> Self {
        Self {
            id: *b.id(),
            content: b.content().to_string(),
            metadata: b.metadata().to_string(),
        }
    }
}

struct AppState {
    service: Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>,
    workspace_path: PathBuf,
}

#[tauri::command]
async fn get_workspace(state: tauri::State<'_, AppState>) -> Result<WorkspaceDto, String> {
    let workspace = state
        .service
        .get_workspace()
        .await
        .map_err(|e| e.to_string())?;

    Ok((&workspace).into())
}

#[tauri::command]
async fn create_block(
    content: String,
    metadata: String,
    state: tauri::State<'_, AppState>,
) -> Result<BlockDto, String> {
    let req = CreateBlockRequest::new(Content::new(&content), Metadata::new(&metadata));

    let block = state
        .service
        .create_block(&req)
        .await
        .map_err(|e| e.to_string())?;

    Ok((&block).into())
}

#[tauri::command]
async fn update_block(
    id: Uuid,
    content: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let req = UpdateBlockRequest::new(id, Content::new(&content));

    state
        .service
        .update_block(&req)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_workspace_path(state: tauri::State<'_, AppState>) -> String {
    state.workspace_path.to_string_lossy().to_string()
}

fn main() {
    let root_path = std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("test_workspace"))
        .unwrap_or_else(|| std::path::PathBuf::from("../../test_workspace")); // Fallback

    tauri::Builder::default()
        .setup({
            let workspace_path = root_path.clone();
            move |app| {
                let app_handle = app.handle().clone();
                let dispatcher = TauriEventDispatcher { app_handle };
                let repo = DirectoryWorkspaceRepository::new(workspace_path.clone());
                let service = Arc::new(Service::new(repo, dispatcher));
                
                app.manage(AppState { 
                    service: service.clone(), 
                    workspace_path: workspace_path.clone() 
                });

                let watcher = FSWatcher::new(workspace_path);
                watcher.watch(move || {
                    service.notify_external_update();
                });

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![get_workspace, create_block, update_block, get_workspace_path])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}
