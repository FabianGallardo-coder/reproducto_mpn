use serde::{Deserialize, Serialize};

use crate::audio::playlist::RepeatMode;
use crate::radio::RadioStation;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomPlaylist {
    pub name: String,
    pub tracks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub music_folder: String,
    pub volume: f32,
    #[serde(default)]
    pub shuffle: bool,
    #[serde(default)]
    pub repeat: RepeatMode,
    #[serde(default)]
    pub last_track_index: Option<usize>,
    #[serde(default)]
    pub last_position: f64,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub custom_playlists: Vec<CustomPlaylist>,
    #[serde(default)]
    pub custom_radio_stations: Vec<RadioStation>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let music_folder = dirs::audio_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| ".".into());

        Self {
            music_folder,
            volume: 0.8,
            shuffle: false,
            repeat: RepeatMode::default(),
            last_track_index: None,
            last_position: 0.0,
            favorites: Vec::new(),
            custom_playlists: Vec::new(),
            custom_radio_stations: Vec::new(),
        }
    }
}
