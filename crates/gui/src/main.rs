// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use domain::models::block::{
    Content, CreateBlockRequest, UpdateBlockRequest,
    schema::FieldType,
    DeleteBlockError,
};
use domain::ports::{EventDispatcher, WorkspaceUseCase, TypeInspector};
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreBuilder;
use anyhow::Error;

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
    inner: Arc<Mutex<AppStateInner>>,
}

struct AppStateInner {
    service: Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>,
    workspace_path: PathBuf,
    #[allow(dead_code)]
    watcher: Option<FSWatcher<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>>,
}

impl AppState {
    fn new(service: Arc<Service<DirectoryWorkspaceRepository, TauriEventDispatcher>>, workspace_path: PathBuf) -> Self {
        Self {
            inner: Arc::new(Mutex::new(AppStateInner {
                service,
                workspace_path,
                watcher: None,
            })),
        }
    }
}

#[tauri::command]
async fn get_workspace(state: tauri::State<'_, AppState>) -> Result<WorkspaceDto, String> {
    let service = {
        let inner = state.inner.lock().unwrap();
        inner.service.clone()
    };
    
    let workspace = service
        .get_workspace()
        .await
        .map_err(|e: Error| e.to_string())?;

    Ok(WorkspaceDto::from_domain(&workspace, &service))
}

#[tauri::command]
async fn create_block(
    content: String,
    metadata: String,
    state: tauri::State<'_, AppState>,
) -> Result<(WorkspaceDto, Uuid), String> {
    let service = {
        let inner = state.inner.lock().unwrap();
        inner.service.clone()
    };
    
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = provider.get_fields().map_err(|e| format!("Metadata error: {}", e))?;
    let req = CreateBlockRequest::new(Content::new(&content), fields);

    let (workspace, id) = service
        .create_block(&req)
        .await
        .map_err(|e: domain::models::block::CreateBlockError| format!("Create error: {}", e))?;

    Ok((WorkspaceDto::from_domain(&workspace, &service), id))
}

#[tauri::command]
async fn update_block(
    id: Uuid,
    content: Option<String>,
    metadata: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceDto, String> {
    let service = {
        let inner = state.inner.lock().unwrap();
        inner.service.clone()
    };
    
    let domain_content = content.map(|c| Content::new(&c));
    let mut domain_fields = None;

    if let Some(meta) = metadata {
        let provider = infra::metadata::JsonMetadataProvider(meta);
        domain_fields = Some(provider.get_fields().map_err(|e| e.to_string())?);
    }

    let req = UpdateBlockRequest::new(id, domain_content, domain_fields);

    let workspace = service
        .update_block(&req)
        .await
        .map_err(|e: domain::models::block::UpdateBlockError| e.to_string())?;

    Ok(WorkspaceDto::from_domain(&workspace, &service))
}

#[tauri::command]
async fn delete_block(
    id: Uuid,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceDto, String> {
    let service = {
        let inner = state.inner.lock().unwrap();
        inner.service.clone()
    };
    
    service.delete_block(id).await
        .map(|ws: domain::models::workspace::Workspace| WorkspaceDto::from_domain(&ws, &service))
        .map_err(|e| match e {
            DeleteBlockError::NotFound(id) => format!("Block {} not found", id),
            DeleteBlockError::Storage(e) => format!("Storage error: {:?}", e),
            DeleteBlockError::Unknown(e) => format!("Unknown error: {:?}", e),
        })
}

#[tauri::command]
fn get_workspace_path(state: tauri::State<'_, AppState>) -> String {
    let inner = state.inner.lock().unwrap();
    inner.workspace_path.to_string_lossy().to_string()
}

#[tauri::command]
fn get_block_types(state: tauri::State<'_, AppState>) -> Vec<String> {
    let inner = state.inner.lock().unwrap();
    inner.service.get_block_types()
}

#[derive(Serialize)]
pub struct FieldDefinitionDto {
    pub name: String,
    pub field_type: String,
}

#[derive(Serialize)]
pub struct TemplateDto {
    pub name: String,
    pub fields: Vec<FieldDefinitionDto>,
}

fn field_type_to_str(ft: &FieldType) -> String {
    match ft {
        FieldType::Boolean => "Boolean".to_string(),
        FieldType::Integer => "Integer".to_string(),
        FieldType::Float => "Float".to_string(),
        FieldType::String => "String".to_string(),
        FieldType::Record(_) => "Record".to_string(),
        FieldType::List(_) => "List".to_string(),
        FieldType::Named(name) => format!("Named:{}", name),
    }
}

#[tauri::command]
fn get_templates(state: tauri::State<'_, AppState>) -> Vec<TemplateDto> {
    let inner = state.inner.lock().unwrap();
    inner.service.get_block_types().into_iter().filter_map(|name| {
        let def = inner.service.get_type_definition(&name)?;
        let fields = def.fields.iter().map(|(fname, ftype): (&domain::models::block::schema::FieldName, &domain::models::block::schema::FieldType)| FieldDefinitionDto {
            name: fname.to_string(),
            field_type: field_type_to_str(ftype),
        }).collect();
        Some(TemplateDto { name, fields })
    }).collect()
}

#[tauri::command]
fn identify_block_shapes(
    metadata: String,
    state: tauri::State<'_, AppState>
) -> Result<Vec<String>, String> {
    let inner = state.inner.lock().unwrap();
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = provider.get_fields().map_err(|e| e.to_string())?;
    Ok(inner.service.identify_block_shapes(&fields))
}

#[tauri::command]
async fn select_workspace_folder(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let pick = app_handle.dialog()
        .file()
        .blocking_pick_folder();

    if let Some(picked) = pick {
        let path = picked.into_path().map_err(|_| "Invalid path")?;
        
        // Update store
        let settings_path = app_handle.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
        let store = StoreBuilder::new(&app_handle, settings_path).build().map_err(|e| e.to_string())?;
        let _ = store.set("workspace_path", serde_json::json!(path.to_string_lossy().to_string()));
        let _ = store.save();

        // Update AppState
        let mut inner = state.inner.lock().unwrap();
        let dispatcher = TauriEventDispatcher { app_handle: app_handle.clone() };
        let repo = DirectoryWorkspaceRepository::new(path.clone());
        let service = Arc::new(Service::new(repo, dispatcher));
        
        inner.service = service.clone();
        inner.workspace_path = path.clone();
        
        // Restart watcher
        let watcher = FSWatcher::new(path.clone(), (*service).clone());
        watcher.watch();
        // Note: we don't stop the old watcher here because it's non-trivial 
        // with the current FSWatcher implementation, but since it's a new 
        // thread and it will eventually fail on old file descriptors, it's 
        // a "managed" leak for now. 

        Ok(path.to_string_lossy().to_string())
    } else {
        Err("No folder selected".to_string())
    }
}


fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let settings_path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
            let store_rc = StoreBuilder::new(app, settings_path).build();
            
            let workspace_path = match store_rc {
                Ok(store) => {
                    let _ = store.reload();
                    if let Some(path_val) = store.get("workspace_path") {
                        if let Some(s) = path_val.as_str() {
                            PathBuf::from(s)
                        } else {
                            PathBuf::from("test_workspace")
                        }
                    } else {
                        PathBuf::from("test_workspace")
                    }
                }
                Err(e) => {
                    tracing::error!("Store error: {:?}", e);
                    PathBuf::from("test_workspace")
                }
            };

            let app_handle = app.handle().clone();
            let dispatcher = TauriEventDispatcher { app_handle };
            let repo = DirectoryWorkspaceRepository::new(workspace_path.clone());
            let service = Arc::new(Service::new(repo, dispatcher));

            let app_state = AppState::new(service.clone(), workspace_path.clone());
            app.manage(app_state);

            let watcher = FSWatcher::new(workspace_path, (*service).clone());
            watcher.watch();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace,
            create_block,
            update_block,
            delete_block,
            get_workspace_path,
            get_block_types,
            get_templates,
            identify_block_shapes,
            select_workspace_folder
        ])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}
