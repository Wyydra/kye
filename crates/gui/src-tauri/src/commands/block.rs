use uuid::Uuid;
use domain::models::block::{CreateBlockRequest, UpdateBlockRequest};
use crate::state::AppState;
use crate::dto::{WorkspaceDto, TemplateDto, FieldDefinitionDto, field_type_to_str};
use crate::error::{AppError, AppResult};
use domain::ports::{WorkspaceUseCase, TypeInspector, TypeManagementUseCase};
use infra::types::dto::TypeDefinitionDto;

#[tauri::command]
pub async fn create_block(
    content: String,
    metadata: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<(WorkspaceDto, Uuid)> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    
    let provider = infra::metadata::JsonMetadataProvider(metadata);
    let mut fields = provider.get_fields().map_err(|e| format!("Metadata error: {}", e))?;
    
    if !content.trim().is_empty() {
        fields.insert(domain::models::block::schema::FieldName::new("body"), domain::models::block::schema::Value::String(content));
    }

    let req = CreateBlockRequest::new(fields);

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
    
    let mut fields = if let Some(meta) = metadata {
        let provider = infra::metadata::JsonMetadataProvider(meta);
        provider.get_fields().map_err(|e| e.to_string())?
    } else {
        domain::models::block::schema::Fields::new()
    };

    if let Some(c) = content {
        fields.insert(domain::models::block::schema::FieldName::new("body"), domain::models::block::schema::Value::String(c));
    }

    let req = UpdateBlockRequest::new(id, fields);
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
            layout: def.layout.map(|l| l.into()),
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

#[tauri::command]
pub async fn register_type(
    name: String,
    definition: TypeDefinitionDto,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let service = state.service().ok_or_else(|| AppError::InternalError("No workspace selected".into()))?;
    
    service.register_type(&name, definition.to_domain()).await?;
    
    Ok(())
}
