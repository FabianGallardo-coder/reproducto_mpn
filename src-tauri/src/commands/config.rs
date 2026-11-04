use std::sync::Arc;
use tauri::State;

use crate::config::models::AppConfig;
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, AppError> {
    let config = state
        .config
        .lock()
        .map_err(|e| AppError::Config(e.to_string()))?;
    Ok(config.get().clone())
}

fn validate_config(config: &AppConfig) -> Result<(), AppError> {
    if config.volume < 0.0 || config.volume > 1.0 {
        return Err(AppError::Config("volume must be 0.0..=1.0".into()));
    }
    if config.custom_radio_stations.len() > 100 {
        return Err(AppError::Config("max 100 custom radio stations".into()));
    }
    if config.custom_playlists.len() > 50 {
        return Err(AppError::Config("max 50 custom playlists".into()));
    }
    if config.favorites.len() > 10000 {
        return Err(AppError::Config("max 10000 favorites".into()));
    }
    for station in &config.custom_radio_stations {
        if !station.url.starts_with("http://") && !station.url.starts_with("https://") {
            return Err(AppError::Config(format!(
                "invalid station URL: {}",
                station.url
            )));
        }
        if station.name.len() > 100 || station.name.is_empty() {
            return Err(AppError::Config("station name must be 1-100 chars".into()));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_config(state: State<'_, Arc<AppState>>, config: AppConfig) -> Result<(), AppError> {
    validate_config(&config)?;
    let mut store = state
        .config
        .lock()
        .map_err(|e| AppError::Config(e.to_string()))?;
    store.set(config)
}
