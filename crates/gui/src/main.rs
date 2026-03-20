// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use domain::models::block::{Content, CreateBlockRequest, Metadata};
use domain::service::Service;
use domain::ports::BlockService;
use infra::markdown::DirectoryWorkspaceRepository;

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
    service: Arc<Service<DirectoryWorkspaceRepository>>,
}

#[tauri::command]
async fn get_workspace(state: tauri::State<'_, AppState>) -> Result<WorkspaceDto, String> {
    let workspace = state.service.get_workspace().await.map_err(|e| e.to_string())?;
    
    Ok((&workspace).into())
}

#[tauri::command]
async fn create_block(content: String, metadata: String, state: tauri::State<'_, AppState>) -> Result<BlockDto, String> {
    let req = CreateBlockRequest::new(Content::new(&content), Metadata::new(&metadata));
    
    let block = state.service.create_block(&req).await.map_err(|e| e.to_string())?;
    
    Ok((&block).into())
}


fn main() {
    let root_path = std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("test_workspace"))
        .unwrap_or_else(|| std::path::PathBuf::from("../../test_workspace")); // Fallback

    let repo = DirectoryWorkspaceRepository::new(root_path);
    let service = Arc::new(Service::new(repo));

    tauri::Builder::default()
        .manage(AppState { service })
        .invoke_handler(tauri::generate_handler![get_workspace, create_block])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}
