use crate::error::AppError;

#[tauri::command]
pub fn youtube_metadata(url: String) -> Result<crate::youtube::YouTubeMeta, AppError> {
    crate::youtube::fetch_metadata(&url).map_err(AppError::Audio)
}

#[tauri::command]
pub fn youtube_stream_url(url: String) -> Result<String, AppError> {
    crate::youtube::get_audio_stream_url(&url).map_err(AppError::Audio)
}

#[tauri::command]
pub async fn fetch_lyrics(
    artist: String,
    track: String,
    album: Option<String>,
    duration: Option<f64>,
) -> Result<crate::lyrics::LrcLyrics, AppError> {
    crate::lyrics::fetch_lyrics(&artist, &track, album.as_deref(), duration)
        .await
        .map_err(AppError::Audio)
}
