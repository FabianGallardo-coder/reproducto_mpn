use std::sync::Arc;
use tauri::State;

use crate::AppState;
use crate::error::AppError;

#[tauri::command]
pub fn play(state: State<'_, Arc<AppState>>, path: String) -> Result<(), AppError> {
    state.player.play_file(&path)
}

#[tauri::command]
pub fn pause(state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    state.player.pause()
}

#[tauri::command]
pub fn resume(state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    state.player.resume()
}

#[tauri::command]
pub fn seek(_state: State<'_, Arc<AppState>>, _position: f64) -> Result<(), AppError> {
    // ponytail: rodio sink doesn't expose seek directly — implement when needed
    Ok(())
}

#[tauri::command]
pub fn next(_state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    // ponytail: playlist navigation — implement with playlist manager
    Ok(())
}

#[tauri::command]
pub fn previous(_state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
pub fn set_volume(state: State<'_, Arc<AppState>>, volume: f32) -> Result<(), AppError> {
    let vol = volume.clamp(0.0, 1.0);
    state.player.set_volume(vol)
}
