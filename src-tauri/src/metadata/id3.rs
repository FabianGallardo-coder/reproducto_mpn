use crate::error::AppError;
use crate::metadata::cache::CachedTrack;

use id3::TagLike;

pub fn parse_file(path: &str) -> Result<CachedTrack, AppError> {
    let tag = id3::Tag::read_from_path(path)
        .map_err(|e| AppError::Metadata(format!("Failed to read ID3 tag: {e}")))?;

    let title = tag.title().unwrap_or("Unknown").to_string();
    let artist = tag.artist().unwrap_or("Unknown").to_string();
    let album = tag.album().unwrap_or("Unknown").to_string();

    let duration = tag.duration().map(|d| d as f64).unwrap_or(0.0);

    Ok(CachedTrack {
        path: path.to_string(),
        title,
        artist,
        album,
        duration,
    })
}
