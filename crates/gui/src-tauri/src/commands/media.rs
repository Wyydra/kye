use crate::error::{AppError, AppResult};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn import_asset(source_path: String, state: State<'_, AppState>) -> AppResult<String> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let node_id = service
        .import_asset(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to import asset: {}", e)))?;

    Ok(node_id.to_string())
}

#[tauri::command]
pub async fn open_asset(target_path: String, state: State<'_, AppState>) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    service
        .open_external(&target_path)
        .map_err(|e| AppError::Internal(format!("Failed to open asset: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn reveal_asset(target_path: String, state: State<'_, AppState>) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    service
        .reveal_in_explorer(&target_path)
        .map_err(|e| AppError::Internal(format!("Failed to reveal asset: {}", e)))?;

    Ok(())
}
