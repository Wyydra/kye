use uuid::Uuid;
use domain::models::block::{Content, CreateBlockRequest, UpdateBlockRequest};
use domain::ports::{WorkspaceUseCase, TypeInspector};

use crate::state::AppState;
use crate::dto::{WorkspaceDto, TemplateDto, FieldDefinitionDto, field_type_to_str};
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn create_block(
    content: String,
    metadata: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<(WorkspaceDto, Uuid)> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = provider.get_fields().map_err(|e| format!("Metadata error: {}", e))?;
    let req = CreateBlockRequest::new(Content::new(&content), fields);

    let (workspace, id) = service.create_block(&req).await?;

    Ok((WorkspaceDto::from_domain(&workspace, &service), id))
}

#[tauri::command]
pub async fn update_block(
    id: Uuid,
    content: Option<String>,
    metadata: Option<String>,
    state: tauri::State<'_, AppState>,
) -> AppResult<WorkspaceDto> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    
    let domain_content = content.map(|c| Content::new(&c));
    let mut domain_fields = None;

    if let Some(meta) = metadata {
        let provider = infra::metadata::JsonMetadataProvider(meta);
        domain_fields = Some(provider.get_fields().map_err(|e| e.to_string())?);
    }

    let req = UpdateBlockRequest::new(id, domain_content, domain_fields);
    let workspace = service.update_block(&req).await?;

    Ok(WorkspaceDto::from_domain(&workspace, &service))
}

#[tauri::command]
pub async fn delete_block(
    id: Uuid,
    state: tauri::State<'_, AppState>,
) -> AppResult<WorkspaceDto> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    let ws = service.delete_block(id).await?;
    Ok(WorkspaceDto::from_domain(&ws, &service))
}

#[tauri::command]
pub fn get_block_types(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.service().map(|s| s.get_block_types()).unwrap_or_default()
}

#[tauri::command]
pub fn get_templates(state: tauri::State<'_, AppState>) -> Vec<TemplateDto> {
    let service = match state.service() {
        Some(s) => s,
        None => return vec![],
    };
    
    service.get_block_types().into_iter().filter_map(|name| {
        let def = service.get_type_definition(&name)?;
        let fields = def.fields.iter().map(|(fname, ftype)| FieldDefinitionDto {
            name: fname.to_string(),
            field_type: field_type_to_str(ftype),
        }).collect();
        Some(TemplateDto { 
            name, 
            fields, 
        })
    }).collect()
}

#[tauri::command]
pub fn identify_block_shapes(
    metadata: String,
    state: tauri::State<'_, AppState>
) -> AppResult<Vec<String>> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let fields = provider.get_fields().map_err(|e| e.to_string())?;
    Ok(service.identify_block_shapes(&fields))
}
