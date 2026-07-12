use std::sync::Arc;
use tauri::State;

use crate::AppState;
use crate::config::models::AppConfig;
use crate::error::AppError;

#[tauri::command]
pub fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, AppError> {
    let config = state.config.lock().map_err(|e| AppError::Config(e.to_string()))?;
    Ok(config.get().clone())
}

#[tauri::command]
pub fn set_config(state: State<'_, Arc<AppState>>, config: AppConfig) -> Result<(), AppError> {
    let mut store = state.config.lock().map_err(|e| AppError::Config(e.to_string()))?;
    store.set(config)
}
