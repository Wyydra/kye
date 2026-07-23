use tauri::State;
use domain::AssetInfo;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub async fn import_media(
    source_path: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let asset_info = service
        .import_asset(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to import asset: {}", e)))?;

    Ok(asset_info.target_path)
}

#[tauri::command]
pub async fn import_asset(
    source_path: String,
    state: State<'_, AppState>,
) -> AppResult<AssetInfo> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let asset_info = service
        .import_asset(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to import asset: {}", e)))?;

    Ok(asset_info)
}

#[tauri::command]
pub async fn open_asset(
    target_path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    service
        .open_external(&target_path)
        .map_err(|e| AppError::Internal(format!("Failed to open asset: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn reveal_asset(
    target_path: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    service
        .reveal_in_explorer(&target_path)
        .map_err(|e| AppError::Internal(format!("Failed to reveal asset: {}", e)))?;

    Ok(())
}
