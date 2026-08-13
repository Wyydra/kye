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
    let is_high_frequency = matches!(cmd, Command::SetProps { .. } | Command::SetProp { .. });

    tracing::debug!("cmd: {}", cmd);
    let event = service.execute(cmd).map_err(|e| {
        tracing::error!("Command failed: {}", e);
        e
    })?;

    if is_high_frequency {
        tracing::debug!("evt: {}", event);
    } else {
        tracing::info!("evt: {}", event);
    }
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
    let cmds: Vec<Command> = commands.into_iter().map(Command::from).collect();
    tracing::debug!("cmd: Batch({} commands)", count);
    let event = service.execute_batch(cmds).map_err(|e| {
        tracing::error!("Batch execution failed: {}", e);
        e
    })?;
    tracing::info!("evt: {}", event);
    Ok(EventDto::from(&event))
}
