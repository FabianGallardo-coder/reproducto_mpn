use crate::error::AppError;

#[tauri::command]
pub async fn fetch_lyrics(
    artist: String,
    track: String,
    album: Option<String>,
    duration: Option<f64>,
) -> Result<crate::lyrics::LrcLyrics, AppError> {
    crate::lyrics::fetch_lyrics(&artist, &track, album.as_deref(), duration)
        .await
        .map_err(AppError::Integration)
}
