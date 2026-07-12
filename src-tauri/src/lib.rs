mod audio;
mod commands;
mod config;
mod error;
mod events;
mod metadata;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use crate::audio::player::AudioPlayer;
use crate::config::store::ConfigStore;

pub struct AppState {
    pub player: AudioPlayer,
    pub config: Mutex<ConfigStore>,
}

pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let config_path = app
                .path()
                .app_config_dir()
                .map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&config_path).map_err(|e| e.to_string())?;

            let config = ConfigStore::load(&config_path.join("config.json"))
                .map_err(|e| e.to_string())?;

            let player = AudioPlayer::new().map_err(|e| e.to_string())?;

            let state = Arc::new(AppState {
                player,
                config: Mutex::new(config),
            });
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::audio::play,
            commands::audio::pause,
            commands::audio::resume,
            commands::audio::seek,
            commands::audio::next,
            commands::audio::previous,
            commands::audio::set_volume,
            commands::library::scan_folder,
            commands::library::get_tracks,
            commands::config::get_config,
            commands::config::set_config,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        eprintln!("Fatal: {e}");
    }
}
