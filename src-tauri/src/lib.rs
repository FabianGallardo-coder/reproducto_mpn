mod audio;
mod commands;
mod config;
mod error;
mod metadata;

use std::sync::{Arc, Mutex};

use tauri::Manager;
use tauri::Emitter;

use crate::audio::player::AudioPlayer;
use crate::audio::playlist::PlaylistManager;
use crate::config::store::ConfigStore;

pub struct AppState {
    pub player: AudioPlayer,
    pub playlist: Mutex<PlaylistManager>,
    pub config: Mutex<ConfigStore>,
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
                                let _ = app_handle.emit("track-ended", ());
                            }
                            crate::audio::player::AudioEvent::Error(msg) => {
                                let _ = app_handle.emit("playback-error", msg);
                            }
                        }
                    }
                })
                .map(|_| ())
                .map_err(|e| e.to_string())?;

            Ok(())
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
            commands::library::scan_folder,
            commands::config::get_config,
            commands::config::set_config,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("Fatal: {e}");
    }
}
