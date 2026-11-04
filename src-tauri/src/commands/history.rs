use std::sync::Arc;
use tauri::State;

use crate::error::AppError;
use crate::history::PlayEntry;
use crate::AppState;

#[tauri::command]
pub fn record_play(state: State<'_, Arc<AppState>>, entry: PlayEntry) -> Result<(), AppError> {
    let mut history = state
        .history
        .lock()
        .map_err(|e| AppError::Config(e.to_string()))?;
    history.record(entry).map(|_| ())
}

#[tauri::command]
pub fn get_history(state: State<'_, Arc<AppState>>) -> Result<Vec<PlayEntry>, AppError> {
    let history = state
        .history
        .lock()
        .map_err(|e| AppError::Config(e.to_string()))?;
    Ok(history.list())
}

#[tauri::command]
pub fn clear_history(state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    let mut history = state
        .history
        .lock()
        .map_err(|e| AppError::Config(e.to_string()))?;
    history.clear()
}
