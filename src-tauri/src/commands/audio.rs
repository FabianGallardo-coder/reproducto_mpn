use std::sync::Arc;
use std::time::Duration;

use tauri::State;

use crate::audio::playlist::RepeatMode;
use crate::audio::track_info::TrackInfo;
use crate::error::AppError;
use crate::utils::path::validate_file_path;
use crate::AppState;

use std::net::IpAddr;

fn is_private_ip(host: &str) -> bool {
    let clean = host.trim_start_matches('[').trim_end_matches(']');
    match clean.parse::<IpAddr>() {
        Ok(IpAddr::V4(v4)) => v4.is_loopback() || v4.is_link_local() || v4.is_private(),
        Ok(IpAddr::V6(v6)) => v6.is_loopback() || v6.is_unicast_link_local(),
        Err(_) => host == "localhost",
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
    if !position.is_finite() {
        return Err(AppError::Audio("Invalid seek position".into()));
    }
    let pos = Duration::from_secs_f64(position.max(0.0));
    state.player.seek(pos)
}

#[tauri::command]
pub fn next(state: State<'_, Arc<AppState>>) -> Result<Option<TrackInfo>, AppError> {
    let track = {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.next().cloned()
    };
    match track {
        Some(t) => {
            let path = validate_file_path(&t.path, None)?;
            state.player.play_file(&path.to_string_lossy())?;
            Ok(Some(t))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn previous(state: State<'_, Arc<AppState>>) -> Result<Option<TrackInfo>, AppError> {
    let track = {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.previous().cloned()
    };
    match track {
        Some(t) => {
            let path = validate_file_path(&t.path, None)?;
            state.player.play_file(&path.to_string_lossy())?;
            Ok(Some(t))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn set_volume(state: State<'_, Arc<AppState>>, volume: f32) -> Result<(), AppError> {
    if !volume.is_finite() {
        return Err(AppError::Audio("Invalid volume".into()));
    }
    let volume = volume.clamp(0.0, 1.0);
    state.player.set_volume(volume)?;
    state
        .config
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .update(|config| config.volume = volume)
}

#[tauri::command]
pub fn get_state(
    state: State<'_, Arc<AppState>>,
) -> Result<crate::audio::player::PlaybackState, AppError> {
    Ok(state.player.get_state())
}

#[tauri::command]
pub fn set_playlist(
    state: State<'_, Arc<AppState>>,
    tracks: Vec<TrackInfo>,
    index: usize,
) -> Result<(), AppError> {
    const MAX_TRACKS: usize = 100_000;
    if tracks.len() > MAX_TRACKS {
        return Err(AppError::Audio(format!(
            "Playlist too large: {} tracks (max {})",
            tracks.len(),
            MAX_TRACKS
        )));
    }
    let current = {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))?;
        playlist.set_tracks(tracks, index);
        playlist.current().cloned()
    };
    match current {
        Some(t) => {
            let path = validate_file_path(&t.path, None)?;
            state.player.play_file(&path.to_string_lossy())
        }
        None => Ok(()),
    }
}

#[tauri::command]
pub fn set_shuffle(state: State<'_, Arc<AppState>>, on: bool) -> Result<(), AppError> {
    let mut playlist = state
        .playlist
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    playlist.set_shuffle(on);
    state
        .config
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .update(|config| config.shuffle = on)
}

#[tauri::command]
pub fn set_repeat(state: State<'_, Arc<AppState>>, mode: RepeatMode) -> Result<(), AppError> {
    let mut playlist = state
        .playlist
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    playlist.set_repeat(mode);
    state
        .config
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?
        .update(|config| config.repeat = mode)
}

#[tauri::command]
pub fn search(state: State<'_, Arc<AppState>>, query: String) -> Result<Vec<TrackInfo>, AppError> {
    let playlist = state
        .playlist
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    let q = query.to_lowercase();
    Ok(playlist
        .tracks()
        .iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&q)
                || t.artist.to_lowercase().contains(&q)
                || t.album.to_lowercase().contains(&q)
        })
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn play_url(state: State<'_, Arc<AppState>>, url: String) -> Result<(), AppError> {
    let parsed = url::Url::parse(&url).map_err(|_| AppError::Audio("Invalid URL".into()))?;
    let host = parsed.host_str().unwrap_or("");
    if is_private_ip(host) {
        return Err(AppError::Audio(
            "Connections to private IPs are not allowed".into(),
        ));
    }

    // Stop any currently playing audio before playing URL
    state.player.stop()?;
    state.playlist.lock().map_err(|e| AppError::Audio(e.to_string()))?
        .set_tracks(Vec::new(), 0);

    state.player.play_url(&url)
}

#[tauri::command]
pub fn list_radio_stations(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<crate::radio::RadioStation>, AppError> {
    let config = state
        .config
        .lock()
        .map_err(|e| AppError::Audio(e.to_string()))?;
    let mut stations = crate::radio::preset_stations();
    stations.extend(config.get().custom_radio_stations.clone());
    Ok(stations)
}

#[tauri::command]
pub fn update_smtc_metadata(
    state: State<'_, Arc<AppState>>,
    title: String,
    artist: String,
    album: String,
    duration: f64,
) -> Result<(), AppError> {
    state.update_media_controls(&title, &artist, &album, duration);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn localhost_is_private() {
        assert!(is_private_ip("localhost"));
        assert!(is_private_ip("127.0.0.1"));
        assert!(is_private_ip("::1"));
        assert!(is_private_ip("[::1]"));
    }

    #[test]
    fn loopback_127_is_private() {
        assert!(is_private_ip("127.0.0.1"));
        assert!(is_private_ip("127.255.255.255"));
        assert!(is_private_ip("127.0.0.0"));
    }

    #[test]
    fn class_a_private() {
        assert!(is_private_ip("10.0.0.1"));
        assert!(is_private_ip("10.255.255.255"));
        assert!(is_private_ip("10.1.2.3"));
    }

    #[test]
    fn class_b_private() {
        assert!(is_private_ip("172.16.0.1"));
        assert!(is_private_ip("172.31.255.255"));
        assert!(!is_private_ip("172.15.0.1"));
        assert!(!is_private_ip("172.32.0.1"));
    }

    #[test]
    fn class_c_private() {
        assert!(is_private_ip("192.168.0.1"));
        assert!(is_private_ip("192.168.255.255"));
        assert!(!is_private_ip("192.169.0.1"));
    }

    #[test]
    fn link_local_is_private() {
        assert!(is_private_ip("169.254.169.254"));
        assert!(is_private_ip("169.254.1.1"));
    }

    #[test]
    fn public_ips_not_private() {
        assert!(!is_private_ip("8.8.8.8"));
        assert!(!is_private_ip("1.1.1.1"));
        assert!(!is_private_ip("203.0.113.1"));
        assert!(!is_private_ip("example.com"));
        assert!(!is_private_ip(""));
    }

    #[test]
    fn malformed_not_private() {
        assert!(!is_private_ip("999.999.999.999"));
        assert!(!is_private_ip("abc"));
        assert!(!is_private_ip("10.0.0"));
    }
}
