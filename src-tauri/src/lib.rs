mod audio;
mod commands;
mod config;
mod error;
mod metadata;

use std::sync::{Arc, Mutex};

use tauri::Manager;
use tauri::Emitter;
use tauri::WindowEvent;

use crate::audio::player::AudioPlayer;
use crate::audio::playlist::PlaylistManager;
use crate::config::store::ConfigStore;

pub const EVENT_TRACK_ENDED: &str = "track-ended";
pub const EVENT_PLAYBACK_ERROR: &str = "playback-error";

pub struct AppState {
    pub player: AudioPlayer,
    pub playlist: Mutex<PlaylistManager>,
    pub config: Mutex<ConfigStore>,
}

fn save_state_on_close(state: &AppState) {
    let position = state.player.get_state().position;
    let playlist = state.playlist.lock().ok();
    let mut config = match state.config.lock() {
        Ok(c) => c,
        Err(_) => return,
    };

    let current_index = playlist.as_ref().and_then(|p| {
        if p.tracks().is_empty() {
            None
        } else {
            Some(p.current_index())
        }
    });

    let _ = config.update(|c| {
        c.last_track_index = current_index;
        c.last_position = position;
    });
}

pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let config_path = app
                .path()
                .app_config_dir()
                .map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&config_path).map_err(|e| e.to_string())?;

            let config = ConfigStore::load(&config_path.join("config.json"))
                .map_err(|e| e.to_string())?;

            let (player, event_rx) = AudioPlayer::new().map_err(|e| e.to_string())?;

            let state = Arc::new(AppState {
                player,
                playlist: Mutex::new(PlaylistManager::new()),
                config: Mutex::new(config),
            });
            app.manage(state);

            let app_handle = app.handle().clone();
            std::thread::Builder::new()
                .name("audio-events".into())
                .spawn(move || {
                    while let Ok(event) = event_rx.recv() {
                        match event {
                            crate::audio::player::AudioEvent::TrackEnded => {
                                let _ = app_handle.emit(crate::EVENT_TRACK_ENDED, ());
                            }
                            crate::audio::player::AudioEvent::Error(msg) => {
                                let _ = app_handle.emit(crate::EVENT_PLAYBACK_ERROR, msg);
                            }
                        }
                    }
                })
                .map(|_| ())
                .map_err(|e| e.to_string())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<Arc<AppState>>() {
                    save_state_on_close(&state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::audio::play,
            commands::audio::play_index,
            commands::audio::pause,
            commands::audio::resume,
            commands::audio::seek,
            commands::audio::next,
            commands::audio::previous,
            commands::audio::set_volume,
            commands::audio::get_state,
            commands::audio::get_playlist,
            commands::audio::set_playlist,
            commands::audio::set_shuffle,
            commands::audio::get_shuffle,
            commands::audio::set_repeat,
            commands::audio::get_repeat,
            commands::audio::search,
            commands::library::scan_folder,
            commands::config::get_config,
            commands::config::set_config,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("Fatal: {e}");
    }
}
