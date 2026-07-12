use lofty::error::ErrorKind;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::read_from_path;
use lofty::tag::Accessor;

use crate::error::AppError;
use crate::metadata::cache::CachedTrack;

pub fn parse_file(path: &str) -> Result<CachedTrack, AppError> {
    let tagged_file = read_from_path(path).map_err(|e| match e.kind() {
        ErrorKind::UnsupportedTag => AppError::Metadata(format!("No tags: {path}")),
        _ => AppError::Metadata(format!("Read metadata: {e}")),
    })?;

    let duration = tagged_file.properties().duration().as_secs_f64();

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let (title, artist, album) = match tag {
        Some(t) => (
            t.title().unwrap_or_default().into_owned(),
            t.artist().unwrap_or_default().into_owned(),
            t.album().unwrap_or_default().into_owned(),
        ),
        None => (String::new(), String::new(), String::new()),
    };

    let title = if title.is_empty() {
        std::path::Path::new(path)
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Unknown".into())
    } else {
        title
    };

    Ok(CachedTrack {
        path: path.to_string(),
        title,
        artist: if artist.is_empty() { "Unknown".into() } else { artist },
        album: if album.is_empty() { "Unknown".into() } else { album },
        duration,
    })
}
