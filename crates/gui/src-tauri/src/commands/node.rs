use crate::dto::{CommandDto, EventDto};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::command::Command;

#[tauri::command]
pub fn execute_command(
    command: CommandDto,
    state: tauri::State<'_, AppState>,
) -> AppResult<EventDto> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let cmd = Command::from(command);
    let event = service.execute(cmd)?;
    Ok(EventDto::from(&event))
}

#[tauri::command]
pub fn execute_batch(
    commands: Vec<CommandDto>,
    state: tauri::State<'_, AppState>,
) -> AppResult<EventDto> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let cmds = commands.into_iter().map(Command::from).collect();
    let event = service.execute_batch(cmds)?;
    Ok(EventDto::from(&event))
}
