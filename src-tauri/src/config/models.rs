use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub music_folder: String,
    pub volume: f32,
}

impl Default for AppConfig {
    fn default() -> Self {
        let music_folder = dirs::audio_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| ".".into());

        Self {
            music_folder,
            volume: 0.8,
        }
    }
}
