use std::sync::Arc;
use std::time::Duration;

use tauri::State;

use crate::AppState;
use crate::audio::playlist::RepeatMode;
use crate::audio::track_info::TrackInfo;
use crate::error::AppError;
use crate::utils::path::validate_file_path;

#[tauri::command]
pub fn play(state: State<'_, Arc<AppState>>, path: String) -> Result<(), AppError> {
    // For audio playback, we don't restrict to a base directory as users might play from anywhere
    let canonical = validate_file_path(&path, None)?;
    state.player.play_file(&canonical.to_string_lossy())
}

#[tauri::command]
pub fn play_index(state: State<'_, Arc<AppState>>, index: usize) -> Result<Option<TrackInfo>, AppError> {
    let track = {
        let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.play_index(index).cloned()
    };
    match track {
        Some(t) => {
            // For consistency, we could add path validation here too, but the path comes from our own library
            state.player.play_file(&t.path)?;
            Ok(Some(t))
        }
        None => Ok(None),
    }
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
pub fn seek(state: State<'_, Arc<AppState>>, position: f64) -> Result<(), AppError> {
    state.player.seek(Duration::from_secs_f64(position))
}

#[tauri::command]
pub fn next(state: State<'_, Arc<AppState>>) -> Result<Option<TrackInfo>, AppError> {
    let track = {
        let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.next().cloned()
    };
    match track {
        Some(t) => {
            // For consistency, we could add path validation here too, but the path comes from our own library
            state.player.play_file(&t.path)?;
            Ok(Some(t))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn previous(state: State<'_, Arc<AppState>>) -> Result<Option<TrackInfo>, AppError> {
    let track = {
        let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.previous().cloned()
    };
    match track {
        Some(t) => {
            // For consistency, we could add path validation here too, but the path comes from our own library
            state.player.play_file(&t.path)?;
            Ok(Some(t))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn set_volume(state: State<'_, Arc<AppState>>, volume: f32) -> Result<(), AppError> {
    state.player.set_volume(volume.clamp(0.0, 1.0))
}

#[tauri::command]
pub fn get_state(state: State<'_, Arc<AppState>>) -> Result<crate::audio::player::PlaybackState, AppError> {
    Ok(state.player.get_state())
}

#[tauri::command]
pub fn get_playlist(state: State<'_, Arc<AppState>>) -> Result<Vec<TrackInfo>, AppError> {
    let playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    Ok(playlist.tracks().to_vec())
}

#[tauri::command]
pub fn set_playlist(
    state: State<'_, Arc<AppState>>,
    tracks: Vec<TrackInfo>,
    index: usize,
) -> Result<(), AppError> {
    let current = {
        let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.set_tracks(tracks, index);
        playlist.current().cloned()
    };
    match current {
        Some(t) => state.player.play_file(&t.path),
        None => Ok(()),
    }
}

#[tauri::command]
pub fn set_shuffle(state: State<'_, Arc<AppState>>, on: bool) -> Result<(), AppError> {
    let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    playlist.set_shuffle(on);
    Ok(())
}

#[tauri::command]
pub fn get_shuffle(state: State<'_, Arc<AppState>>) -> Result<bool, AppError> {
    let playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    Ok(playlist.is_shuffle())
}

#[tauri::command]
pub fn set_repeat(state: State<'_, Arc<AppState>>, mode: RepeatMode) -> Result<(), AppError> {
    let mut playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    playlist.set_repeat(mode);
    Ok(())
}

#[tauri::command]
pub fn get_repeat(state: State<'_, Arc<AppState>>) -> Result<RepeatMode, AppError> {
    let playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    Ok(playlist.repeat_mode())
}

#[tauri::command]
pub fn search(state: State<'_, Arc<AppState>>, query: String) -> Result<Vec<TrackInfo>, AppError> {
    let playlist = state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?;
    let q = query.to_lowercase();
    Ok(playlist.tracks().iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&q)
                || t.artist.to_lowercase().contains(&q)
                || t.album.to_lowercase().contains(&q)
        })
        .cloned()
        .collect())
}

#[tauri::command]
pub fn get_audio_data(state: State<'_, Arc<AppState>>) -> Result<crate::audio::analyzer::AudioData, AppError> {
    Ok(state.analyzer.get_data())
}

#[tauri::command]
pub fn play_url(state: State<'_, Arc<AppState>>, url: String) -> Result<(), AppError> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(AppError::Audio("Only http/https URLs are allowed".into()));
    }
    state.player.play_url(&url)
}

#[tauri::command]
pub fn list_radio_stations() -> Vec<crate::radio::RadioStation> {
    crate::radio::preset_stations()
}
