mod audio;
mod commands;
mod config;
mod error;
mod history;
mod lyrics;
mod metadata;
mod radio;
mod utils;
mod youtube;
mod youtube_library;

use std::sync::{Arc, Mutex};

use tauri::Emitter;
use tauri::Manager;
use tauri::WindowEvent;

use crate::audio::analyzer::AudioAnalyzer;
use crate::audio::player::AudioPlayer;
use crate::audio::playlist::PlaylistManager;
use crate::config::store::ConfigStore;
use crate::history::HistoryStore;

pub const EVENT_TRACK_ENDED: &str = "track-ended";
pub const EVENT_PLAYBACK_ERROR: &str = "playback-error";
pub const EVENT_OUTPUT_RECOVERED: &str = "playback-output-recovered";
pub const EVENT_AUDIO_DATA: &str = "audio-data";
pub const EVENT_MENU_OPEN_FOLDER: &str = "menu-open-folder";
pub const EVENT_MENU_OPEN_FILE: &str = "menu-open-file";
pub const EVENT_MENU_ABOUT: &str = "menu-about";
pub const EVENT_MENU_SHORTCUTS: &str = "menu-shortcuts";
pub const EVENT_TRAY_SHOW: &str = "tray-show";
const TRAY_QUIT: &str = "tray-quit";

fn restore_main_window(app: &tauri::AppHandle) {
    log::info!("[tray] restore requested");
    let _ = app.emit(EVENT_TRAY_SHOW, ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub struct AppState {
    pub player: AudioPlayer,
    pub playlist: Mutex<PlaylistManager>,
    pub config: Mutex<ConfigStore>,
    pub history: Mutex<HistoryStore>,
    pub analyzer: AudioAnalyzer,
    pub media_controls: Mutex<Option<souvlaki::MediaControls>>,
}

impl AppState {
    pub fn update_media_controls(&self, title: &str, artist: &str, album: &str, duration: f64) {
        if let Ok(mut lock) = self.media_controls.lock() {
            if let Some(ref mut controls) = *lock {
                let _ = controls
                    .set_metadata(souvlaki::MediaMetadata {
                        title: Some(title),
                        artist: Some(artist),
                        album: Some(album),
                        duration: Some(std::time::Duration::from_secs_f64(duration)),
                        cover_url: None,
                    })
                    .map_err(|e| log::warn!("SMTC set_metadata failed: {e}"));
                let _ = controls
                    .set_playback(if self.player.get_state().playing {
                        souvlaki::MediaPlayback::Playing { progress: None }
                    } else {
                        souvlaki::MediaPlayback::Paused { progress: None }
                    })
                    .map_err(|e| log::warn!("SMTC set_playback failed: {e}"));
            }
        }
    }

    pub fn update_media_playback_status(&self, playing: bool) {
        if let Ok(mut lock) = self.media_controls.lock() {
            if let Some(ref mut controls) = *lock {
                let _ = controls
                    .set_playback(if playing {
                        souvlaki::MediaPlayback::Playing { progress: None }
                    } else {
                        souvlaki::MediaPlayback::Paused { progress: None }
                    })
                    .map_err(|e| log::warn!("SMTC set_playback failed: {e}"));
            }
        }
    }
}

fn save_state_on_close(state: &AppState) {
    let position = state.player.get_state().position;
    let playlist = match state.playlist.lock() {
        Ok(p) => p,
        Err(e) => {
            log::warn!("save_state_on_close: playlist mutex poisoned: {e}");
            return;
        }
    };
    let mut config = match state.config.lock() {
        Ok(c) => c,
        Err(e) => {
            log::warn!("save_state_on_close: config mutex poisoned: {e}");
            return;
        }
    };

    let current_index = if playlist.tracks().is_empty() {
        None
    } else {
        Some(playlist.current_index())
    };

    if let Err(e) = config.update(|c| {
        c.last_track_index = current_index;
        c.last_position = position;
    }) {
        log::warn!("save_state_on_close: config update failed: {e}");
    }
}

pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let state = app.state::<Arc<AppState>>();
                        let key_str = format!("{:?}", shortcut);
                        if key_str.contains("MediaPlayPause")
                            || key_str.contains("MediaPlay")
                            || key_str.contains("MediaPause")
                        {
                            let playback = state.player.get_state().playing;
                            if playback {
                                if let Err(e) = state.player.pause() {
                                    log::warn!("Global shortcut pause failed: {e}");
                                }
                            } else {
                                if let Err(e) = state.player.resume() {
                                    log::warn!("Global shortcut resume failed: {e}");
                                }
                            }
                        } else if key_str.contains("MediaTrackNext")
                            || key_str.contains("MediaNextTrack")
                        {
                            if let Ok(mut playlist) = state.playlist.lock() {
                                if let Some(t) = playlist.next().cloned() {
                                    if let Err(e) = state.player.play_file(&t.path) {
                                        log::warn!("Global shortcut next track failed: {e}");
                                    }
                                }
                            }
                        } else if key_str.contains("MediaTrackPrevious")
                            || key_str.contains("MediaPrevTrack")
                        {
                            if let Ok(mut playlist) = state.playlist.lock() {
                                if let Some(t) = playlist.previous().cloned() {
                                    if let Err(e) = state.player.play_file(&t.path) {
                                        log::warn!("Global shortcut prev track failed: {e}");
                                    }
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
                    .init();
            }
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};
            // Register media keys - use numeric codes for keys not in the enum
            let _ = app
                .global_shortcut()
                .register(Shortcut::new(None, Code::MediaPlayPause));
            let _ = app
                .global_shortcut()
                .register(Shortcut::new(None, Code::MediaPlay));
            let _ = app
                .global_shortcut()
                .register(Shortcut::new(None, Code::MediaPause));
            // MediaTrackNext = 0xB0, MediaTrackPrevious = 0xB1 — try with known Code variants
            // These keys will be caught by the string-based handler above if registered via OS

            let config_path = app.path().app_config_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&config_path).map_err(|e| e.to_string())?;

            let config =
                ConfigStore::load(&config_path.join("config.json")).map_err(|e| e.to_string())?;
            let history = HistoryStore::load(&config_path.join("history.json"));

            let analyzer = AudioAnalyzer::new();
            let (player, event_rx) =
                AudioPlayer::new(analyzer.shared()).map_err(|e| e.to_string())?;

            // Initialize SMTC / MPRIS media controls
            use raw_window_handle::{HasWindowHandle, RawWindowHandle};
            use souvlaki::{MediaControls, PlatformConfig};

            let window = app.get_webview_window("main").ok_or("window not found")?;
            let hwnd = match window.window_handle().map(|h| h.as_raw()) {
                Ok(RawWindowHandle::Win32(win32_handle)) => {
                    Some(win32_handle.hwnd.get() as *mut std::ffi::c_void)
                }
                _ => None,
            };

            let controls_config = PlatformConfig {
                dbus_name: "flowplayer",
                display_name: "FlowPlayer",
                hwnd,
            };
            let controls = MediaControls::new(controls_config).ok();

            let state = Arc::new(AppState {
                player,
                playlist: Mutex::new(PlaylistManager::new()),
                config: Mutex::new(config),
                history: Mutex::new(history),
                analyzer,
                media_controls: Mutex::new(None),
            });
            let app_state = Arc::clone(&state);

            if let Some(mut c) = controls {
                let controls_state = Arc::clone(&state);
                let _ = c.attach(move |event| {
                    use souvlaki::MediaControlEvent;
                    match event {
                        MediaControlEvent::Play => {
                            if let Err(e) = controls_state.player.resume() {
                                log::warn!("SMTC Play failed: {e}");
                            }
                            controls_state.update_media_playback_status(true);
                        }
                        MediaControlEvent::Pause => {
                            if let Err(e) = controls_state.player.pause() {
                                log::warn!("SMTC Pause failed: {e}");
                            }
                            controls_state.update_media_playback_status(false);
                        }
                        MediaControlEvent::Toggle => {
                            let playback = controls_state.player.get_state().playing;
                            if playback {
                                if let Err(e) = controls_state.player.pause() {
                                    log::warn!("SMTC Toggle pause failed: {e}");
                                }
                                controls_state.update_media_playback_status(false);
                            } else {
                                if let Err(e) = controls_state.player.resume() {
                                    log::warn!("SMTC Toggle resume failed: {e}");
                                }
                                controls_state.update_media_playback_status(true);
                            }
                        }
                        MediaControlEvent::Next => {
                            if let Ok(mut playlist) = controls_state.playlist.lock() {
                                if let Some(t) = playlist.next().cloned() {
                                    if let Err(e) = controls_state.player.play_file(&t.path) {
                                        log::warn!("SMTC Next failed: {e}");
                                    }
                                    controls_state.update_media_controls(
                                        &t.title,
                                        &t.artist,
                                        &t.album,
                                        t.duration,
                                    );
                                }
                            }
                        }
                        MediaControlEvent::Previous => {
                            if let Ok(mut playlist) = controls_state.playlist.lock() {
                                if let Some(t) = playlist.previous().cloned() {
                                    if let Err(e) = controls_state.player.play_file(&t.path) {
                                        log::warn!("SMTC Previous failed: {e}");
                                    }
                                    controls_state.update_media_controls(
                                        &t.title,
                                        &t.artist,
                                        &t.album,
                                        t.duration,
                                    );
                                }
                            }
                        }
                        _ => {}
                    }
                });
                if let Ok(mut lock) = state.media_controls.lock() {
                    *lock = Some(c);
                }
            }

            app.manage(state);
            app.manage(commands::window::WindowMemory::default());
            app.manage(youtube_library::LibraryState::new(
                app.path().app_data_dir()?.join("youtube"),
                &app.path().app_cache_dir()?.join("youtube"),
            ));

            // The app draws its own menu bar inside the webview so it matches the
            // theme; the tray icon is the way back from the Zen wallpaper mode.
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            let show = MenuItem::with_id(app, EVENT_TRAY_SHOW, "Mostrar FlowPlayer", true, None::<&str>)?;
            let open_folder =
                MenuItem::with_id(app, EVENT_MENU_OPEN_FOLDER, "Abrir carpeta", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, TRAY_QUIT, "Salir", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show, &open_folder, &quit])?;
            let mut tray = TrayIconBuilder::with_id("flowplayer-tray")
                .tooltip("FlowPlayer")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle, event| match event.id().as_ref() {
                    EVENT_TRAY_SHOW => restore_main_window(app_handle),
                    EVENT_MENU_OPEN_FOLDER => {
                        restore_main_window(app_handle);
                        let _ = app_handle.emit(EVENT_MENU_OPEN_FOLDER, ());
                    }
                    TRAY_QUIT => {
                        if let Some(state) = app_handle.try_state::<Arc<AppState>>() {
                            save_state_on_close(&state);
                        }
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            let app_handle = app.handle().clone();
            std::thread::Builder::new()
                .name("audio-events".into())
                .spawn(move || {
                    loop {
                        while let Ok(event) = event_rx.try_recv() {
                            match event {
                                crate::audio::player::AudioEvent::TrackEnded => {
                                    log::info!("[events] TrackEnded");
                                    let _ = app_handle.emit(crate::EVENT_TRACK_ENDED, ());
                                }
                                crate::audio::player::AudioEvent::Error(msg) => {
                                    log::error!("[events] PlaybackError: {msg}");
                                    let _ = app_handle.emit(crate::EVENT_PLAYBACK_ERROR, msg);
                                }
                                crate::audio::player::AudioEvent::OutputRecovered => {
                                    let _ = app_handle.emit(crate::EVENT_OUTPUT_RECOVERED, ());
                                }
                            }
                        }

                        // Only emit audio data when playing (save CPU when paused)
                        if app_state.player.get_state().playing {
                            let audio_data = app_state.analyzer.get_data();
                            let _ = app_handle.emit(crate::EVENT_AUDIO_DATA, audio_data);
                        }

                        std::thread::sleep(std::time::Duration::from_millis(50));
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
            commands::audio::pause,
            commands::audio::resume,
            commands::audio::seek,
            commands::audio::next,
            commands::audio::previous,
            commands::audio::set_volume,
            commands::audio::get_state,
            commands::audio::set_playlist,
            commands::audio::set_shuffle,
            commands::audio::set_repeat,
            commands::audio::search,
            commands::audio::play_url,
            commands::audio::list_radio_stations,
            commands::audio::update_smtc_metadata,
            youtube_library::youtube_library,
            youtube_library::youtube_search,
            youtube_library::youtube_inspect,
            youtube_library::youtube_enqueue,
            youtube_library::youtube_cancel,
            youtube_library::youtube_retry,
            commands::integrations::fetch_lyrics,
            commands::library::scan_folder,
            commands::library::get_cover,
            commands::library::get_track_info,
            commands::config::get_config,
            commands::config::set_config,
            commands::window::set_window_mode,
            commands::history::record_play,
            commands::history::get_history,
            commands::history::clear_history,
        ])
        .build(tauri::generate_context!());

    match result {
        Ok(app) => app.run(|handle, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                if let Some(state) = handle.try_state::<youtube_library::LibraryState>() {
                    if let Ok(library) = state.get() {
                        library.stop();
                    }
                }
            }
        }),
        Err(e) => log::error!("Fatal: {e}"),
    }
}
