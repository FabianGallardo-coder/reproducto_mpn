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

// ponytail: global client, per-request timeouts if needed. Cheap to clone (Arc internally).
pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("FlowPlayer/0.1")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub async fn fetch_lyrics(
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

    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("LRCLib request failed: {e}"))?;

    if resp.status().as_u16() == 404 {
        return Err("No lyrics found".into());
    }
    if !resp.status().is_success() {
        return Err(format!("LRCLib error: {}", resp.status()));
    }

    resp.json::<LrcLyrics>()
        .await
        .map_err(|e| format!("Failed to parse LRCLib response: {e}"))
}
