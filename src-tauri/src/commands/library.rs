use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::audio::sources::local;
use crate::error::AppError;
use crate::metadata::id3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackInfo {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
}

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<TrackInfo>, AppError> {
    let mut tracks = Vec::new();

    for entry in WalkDir::new(&path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path().to_string_lossy();
        if !local::is_supported(&file_path) {
            continue;
        }

        match id3::parse_file(&file_path) {
            Ok(meta) => tracks.push(TrackInfo {
                path: meta.path,
                title: meta.title,
                artist: meta.artist,
                album: meta.album,
                duration: meta.duration,
            }),
            Err(_) => {
                tracks.push(TrackInfo {
                    path: file_path.into_owned(),
                    title: entry.file_name().to_string_lossy().into_owned(),
                    artist: "Unknown".into(),
                    album: "Unknown".into(),
                    duration: 0.0,
                });
            }
        }
    }

    Ok(tracks)
}

#[tauri::command]
pub fn get_tracks(path: String) -> Result<Vec<TrackInfo>, AppError> {
    scan_folder(path)
}
