use base64::Engine;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub async fn import_asset(source_path: String, state: State<'_, AppState>) -> AppResult<String> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let asset_url = service
        .import_asset_from_file(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to import asset: {}", e)))?;

    Ok(asset_url)
}

#[tauri::command]
pub async fn read_asset_data_url(target_path: String, state: State<'_, AppState>) -> AppResult<String> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let bytes = service
        .read_asset(&target_path)
        .map_err(|e| AppError::Internal(format!("Failed to read asset bytes: {}", e)))?;

    let ext = target_path.split('.').last().unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "mp4" => "video/mp4",
        "mp3" | "wav" | "ogg" => "audio/mpeg",
        _ => "application/octet-stream",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
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
