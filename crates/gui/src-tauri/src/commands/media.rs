use tauri::{AppHandle, State};
use tauri_plugin_fs::FsExt;
use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub async fn import_media(
    source_path: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    let bytes = if source_path.contains("://") {
        let url = tauri::Url::parse(&source_path)
            .map_err(|e| AppError::Internal(format!("Failed to parse media URI: {}", e)))?;
        app_handle.fs().read(url)
    } else {
        app_handle.fs().read(Path::new(&source_path))
    }.map_err(|e| AppError::Internal(format!("Failed to read source media: {}", e)))?;

    let extension = Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");

    let relative_url = service
        .save_media(&bytes, extension)
        .map_err(|e| AppError::Internal(format!("Failed to save media: {}", e)))?;

    Ok(relative_url)
}
