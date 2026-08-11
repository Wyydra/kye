use crate::dto::{CommandDto, EventDto};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::command::Command;

#[tauri::command]
pub fn execute_command(
    command: CommandDto,
    state: tauri::State<'_, AppState>,
) -> AppResult<EventDto> {
    let service = state.service().ok_or_else(|| {
        tracing::warn!("execute_command rejected: No workspace selected");
        AppError::Internal("No workspace selected".into())
    })?;
    let cmd = Command::from(command);
    tracing::debug!("Executing domain command: {:?}", cmd);
    let event = service.execute(cmd).map_err(|e| {
        tracing::error!("Command execution failed: {:?}", e);
        e
    })?;
    tracing::info!("Domain command executed successfully: {:?}", event);
    Ok(EventDto::from(&event))
}

#[tauri::command]
pub fn execute_batch(
    commands: Vec<CommandDto>,
    state: tauri::State<'_, AppState>,
) -> AppResult<EventDto> {
    let service = state.service().ok_or_else(|| {
        tracing::warn!("execute_batch rejected: No workspace selected");
        AppError::Internal("No workspace selected".into())
    })?;
    let count = commands.len();
    let cmds = commands.into_iter().map(Command::from).collect();
    tracing::debug!("Executing batch of {} commands", count);
    let event = service.execute_batch(cmds).map_err(|e| {
        tracing::error!("Batch command execution failed: {:?}", e);
        e
    })?;
    tracing::info!("Batch executed successfully: {} commands applied", count);
    Ok(EventDto::from(&event))
}
