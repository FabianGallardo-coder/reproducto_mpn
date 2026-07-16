use std::path::PathBuf;
use walkdir::WalkDir;

use crate::audio::sources::local;
use crate::audio::track_info::TrackInfo;
use crate::error::AppError;
use crate::metadata::id3;
use crate::utils::path::{validate_dir_path, validate_file_path};

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<TrackInfo>, AppError> {
    // Get the directory path for validation as base directory
    let dir_path = PathBuf::from(&path);
    let dir = validate_dir_path(&path, Some(&dir_path))?;
    let mut tracks = Vec::new();

    for entry in WalkDir::new(&dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path().to_string_lossy();

        // Symlink protection: ensure the resolved path is still within our directory
        let canonical_path = match std::fs::canonicalize(entry.path()) {
            Ok(canonical) => canonical,
            Err(_) => {
                continue;
            }
        };

        let dir_canonical = match std::fs::canonicalize(&dir) {
            Ok(canonical) => canonical,
            Err(_) => {
                // Cannot verify path safety — skip entire directory
                return Ok(Vec::new());
            }
        };

        if !canonical_path.starts_with(&dir_canonical) {
            continue;
        }

        if !local::is_supported(&file_path) {
            continue;
        }

        match id3::parse_file(&file_path) {
            Ok(track) => tracks.push(track),
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
pub fn get_cover(path: String) -> Result<Option<Vec<u8>>, AppError> {
    use lofty::file::TaggedFileExt;
    use lofty::read_from_path;

    // For get_cover, we don't restrict to a base directory as it might be called from anywhere
    let canonical = validate_file_path(&path, None)?;
    let tagged_file = read_from_path(&canonical).map_err(|e| AppError::Metadata(e.to_string()))?;

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    match tag {
        Some(t) => {
            let pictures = t.pictures();
            if let Some(picture) = pictures.first() {
                Ok(Some(picture.data().to_vec()))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}
