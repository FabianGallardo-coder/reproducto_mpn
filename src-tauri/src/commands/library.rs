use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::Manager;
use walkdir::WalkDir;

use crate::audio::sources::local;
use crate::audio::track_info::TrackInfo;
use crate::error::AppError;
use crate::metadata::id3;
use crate::utils::path::{validate_dir_path, validate_file_path};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub processed: usize,
    pub found: usize,
    pub current: String,
}

#[tauri::command]
pub async fn scan_folder(
    path: String,
    on_progress: Channel<ScanProgress>,
) -> Result<Vec<TrackInfo>, AppError> {
    let dir_path = PathBuf::from(&path);
    let dir = validate_dir_path(&path, Some(&dir_path))?;

    // Walkdir + lofty are blocking I/O — push them off the IPC/async runtime.
    let progress_tx = on_progress;
    let dir_clone = dir.clone();
    let join = tauri::async_runtime::spawn_blocking(move || {
        let mut tracks = Vec::new();
        let mut processed: usize = 0;
        let mut found: usize = 0;

        let dir_canonical = match std::fs::canonicalize(&dir_clone) {
            Ok(c) => c,
            Err(_) => return Ok::<_, AppError>(tracks),
        };

        for entry in WalkDir::new(&dir_clone).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }

            processed += 1;
            let file_path = entry.path().to_string_lossy();
            let file_path_str: String = file_path.into_owned();

            // Symlink protection
            let canonical_path = match std::fs::canonicalize(entry.path()) {
                Ok(c) => c,
                Err(_) => continue,
            };
            if !canonical_path.starts_with(&dir_canonical) {
                continue;
            }

            if !local::is_supported(&file_path_str) {
                if processed.is_multiple_of(25) {
                    let _ = progress_tx.send(ScanProgress {
                        processed,
                        found,
                        current: file_path_str,
                    });
                }
                continue;
            }

            let track = match id3::parse_file(&file_path_str) {
                Ok(t) => t,
                Err(_) => TrackInfo {
                    path: file_path_str.clone(),
                    title: entry.file_name().to_string_lossy().into_owned(),
                    artist: "Unknown".into(),
                    album: "Unknown".into(),
                    duration: 0.0,
                },
            };
            found += 1;
            tracks.push(track);

            if processed.is_multiple_of(25) {
                let _ = progress_tx.send(ScanProgress {
                    processed,
                    found,
                    current: file_path_str,
                });
            }
        }
        Ok(tracks)
    });

    join.await.map_err(|e| AppError::Audio(format!("Scan join: {e}")))?
}

#[tauri::command]
pub fn get_cover(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<Vec<u8>>, AppError> {
    use lofty::file::TaggedFileExt;
    use lofty::read_from_path;

    // For get_cover, we don't restrict to a base directory as it might be called from anywhere
    let canonical = validate_file_path(&path, None)?;

    // ponytail: on-disk cover cache keyed by md5(path). Invalidated by mtime.
    // Avoids re-decoding the same MP3's tags on every track selection.
    if let Ok(cache_path) = cover_cache_path(&app, &canonical) {
        if cache_path.exists() {
            if let Ok(cached) = std::fs::read(&cache_path) {
                if !cached.is_empty() {
                    return Ok(Some(cached));
                }
            }
        }
    }

    let tagged_file = read_from_path(&canonical).map_err(|e| AppError::Metadata(e.to_string()))?;
    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());
    let picture_bytes = match tag.and_then(|t| t.pictures().first()) {
        Some(pic) => pic.data().to_vec(),
        None => return Ok(None),
    };

    if let Ok(cache_path) = cover_cache_path(&app, &canonical) {
        if let Some(parent) = cache_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&cache_path, &picture_bytes);
    }

    Ok(Some(picture_bytes))
}

fn cover_cache_path(
    app: &tauri::AppHandle,
    file: &std::path::Path,
) -> Result<PathBuf, AppError> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    file.hash(&mut hasher);
    let h = hasher.finish();

    let cache_root = app
        .path()
        .app_cache_dir()
        .map_err(|e| AppError::Io(std::io::Error::other(format!("cache dir: {e}"))))?;
    Ok(cache_root.join("covers").join(format!("{h:016x}.bin")))
}
