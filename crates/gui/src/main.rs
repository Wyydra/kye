// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use domain::models::block::{Content, CreateBlockRequest, UpdateBlockRequest};
use domain::ports::{BlockService, EventDispatcher, MetadataProvider, WorkspaceWatcher};
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;
use tauri::{Emitter, Manager};

#[derive(Clone)]
pub struct TauriEventDispatcher {
    app_handle: tauri::AppHandle,
}

impl EventDispatcher for TauriEventDispatcher {
    fn dispatch_workspace_updated(&self) {
        if let Err(e) = self.app_handle.emit("workspace_updated", ()) {
            tracing::error!("Failed to emit workspace_updated event: {}", e);
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
    pub shapes: Vec<String>,
}

impl WorkspaceDto {
    pub fn from_domain(
        w: &domain::models::workspace::Workspace,
        service: &Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>,
    ) -> Self {
        Self {
            name: w.name().to_string(),
            blocks: w.blocks().iter().map(|b| (b, service).into()).collect(),
        }
    }
}

impl From<(&domain::models::block::Block, &Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>)> for BlockDto {
    fn from((b, service): (&domain::models::block::Block, &Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>)) -> Self {
        Self {
            id: *b.id(),
            content: b.content().to_string(),
            metadata: infra::metadata::render_json(b.id(), b.metadata()),
            shapes: service.identify_block_shapes(b.metadata().fields()),
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

    Ok(WorkspaceDto::from_domain(&workspace, &state.service))
}

#[tauri::command]
async fn create_block(
    content: String,
    metadata: String,
    state: tauri::State<'_, AppState>,
) -> Result<(WorkspaceDto, Uuid), String> {
    let metadata_provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = metadata_provider.get_fields().map_err(|e| {
        format!("Metadata error: {}", e)
    })?;
    let req = CreateBlockRequest::new(Content::new(&content), fields);

    let (workspace, id) = state
        .service
        .create_block(&req)
        .await
        .map_err(|e| format!("Create error: {}", e))?;

    Ok((WorkspaceDto::from_domain(&workspace, &state.service), id))
}

#[tauri::command]
async fn update_block(
    id: Uuid,
    content: Option<String>,
    metadata: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceDto, String> {
    let domain_content = content.map(|c| Content::new(&c));
    let mut domain_fields = None;

    if let Some(meta) = metadata {
        let provider = infra::metadata::JsonMetadataProvider(meta);
        domain_fields = Some(provider.get_fields().map_err(|e| e.to_string())?);
    }

    let req = UpdateBlockRequest::new(id, domain_content, domain_fields);

    let workspace = state
        .service
        .update_block(&req)
        .await
        .map_err(|e| e.to_string())?;

    Ok(WorkspaceDto::from_domain(&workspace, &state.service))
}

#[tauri::command]
async fn delete_block(
    id: Uuid,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceDto, String> {
    let workspace = state
        .service
        .delete_block(id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(WorkspaceDto::from_domain(&workspace, &state.service))
}

#[tauri::command]
fn get_workspace_path(state: tauri::State<'_, AppState>) -> String {
    state.workspace_path.to_string_lossy().to_string()
}

#[tauri::command]
fn get_block_types(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.service.get_block_types()
}

#[derive(Serialize)]
pub struct TemplateDto {
    pub name: String,
    pub fields: String,
}

#[tauri::command]
fn get_templates(state: tauri::State<'_, AppState>) -> Vec<TemplateDto> {
    state.service.get_block_types().into_iter().map(|name| {
        TemplateDto {
            name,
            fields: "{}".to_string(),
        }
    }).collect()
}

#[tauri::command]
fn identify_block_shapes(
    metadata: String,
    state: tauri::State<'_, AppState>
) -> Result<Vec<String>, String> {
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = provider.get_fields().map_err(|e| e.to_string())?;
    Ok(state.service.identify_block_shapes(&fields))
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

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
                    workspace_path: workspace_path.clone(),
                });

                let watcher = FSWatcher::new(workspace_path, (*service).clone());
                watcher.watch();

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace,
            create_block,
            update_block,
            delete_block,
            get_workspace_path,
            get_block_types,
            get_templates,
            identify_block_shapes
        ])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}
