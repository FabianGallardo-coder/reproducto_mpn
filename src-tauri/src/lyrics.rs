use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LrcLyrics {
    pub id: i64,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub duration: Option<f64>,
    pub instrumental: bool,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

pub fn fetch_lyrics(
    artist: &str,
    track: &str,
    album: Option<&str>,
    duration: Option<f64>,
) -> Result<LrcLyrics, String> {
    let mut url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}",
        urlencoding::encode(artist),
        urlencoding::encode(track),
    );
    if let Some(a) = album {
        url.push_str(&format!("&album_name={}", urlencoding::encode(a)));
    }
    if let Some(d) = duration {
        url.push_str(&format!("&duration={d}"));
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let resp = client.get(&url)
        .send()
        .map_err(|e| format!("LRCLib request failed: {e}"))?;

    if resp.status().as_u16() == 404 {
        return Err("No lyrics found".into());
    }
    if !resp.status().is_success() {
        return Err(format!("LRCLib error: {}", resp.status()));
    }

    resp.json::<LrcLyrics>()
        .map_err(|e| format!("Failed to parse LRCLib response: {e}"))
}
