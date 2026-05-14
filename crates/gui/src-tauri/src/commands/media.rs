use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[tauri::command]
pub fn import_media(
    source_path: String,
    state: State<'_, AppState>,
) -> AppResult<String> {
    let service = state.service().ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    
    let relative_url = service
        .import_media(&source_path)
        .map_err(|e| AppError::Internal(format!("Failed to import media: {}", e)))?;
        
    Ok(relative_url)
}
