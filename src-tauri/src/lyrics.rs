use serde::{Deserialize, Serialize};
use std::time::Duration;

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

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("FlowPlayer/0.1")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn http_client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(build_client)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encoding_basic() {
        let artist = "The Beatles";
        let track = "Let It Be";
        let url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            urlencoding::encode(artist),
            urlencoding::encode(track),
        );
        assert!(url.contains("The%20Beatles"));
        assert!(url.contains("Let%20It%20Be"));
    }

    #[test]
    fn url_encoding_special_chars() {
        let artist = "AC/DC";
        let track = "Highway to Hell (Remastered)";
        let url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            urlencoding::encode(artist),
            urlencoding::encode(track),
        );
        assert!(url.contains("AC%2FDC"));
        assert!(url.contains("Highway%20to%20Hell%20%28Remastered%29"));
    }

    #[test]
    fn url_encoding_unicode() {
        let artist = "Björk";
        let track = "Jóga";
        let url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            urlencoding::encode(artist),
            urlencoding::encode(track),
        );
        assert!(url.contains("Bj%C3%B6rk"));
        assert!(url.contains("J%C3%B3ga"));
    }

    #[test]
    fn url_encoding_empty() {
        let url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            urlencoding::encode(""),
            urlencoding::encode(""),
        );
        assert!(url.contains("artist_name=&track_name="));
    }

    #[test]
    fn lrc_lyrics_fields() {
        let lrc = LrcLyrics {
            id: 1,
            track_name: "Test".into(),
            artist_name: "Artist".into(),
            album_name: Some("Album".into()),
            duration: Some(200.0),
            instrumental: false,
            plain_lyrics: Some("line1\nline2".into()),
            synced_lyrics: Some("[00:01.00]line1\n[00:02.00]line2".into()),
        };
        assert_eq!(lrc.id, 1);
        assert!(!lrc.instrumental);
        assert!(lrc.plain_lyrics.is_some());
        assert!(lrc.synced_lyrics.is_some());
    }

    #[test]
    fn lrc_instrumental_flag() {
        let lrc = LrcLyrics {
            id: 2,
            track_name: "Interlude".into(),
            artist_name: "Artist".into(),
            album_name: None,
            duration: None,
            instrumental: true,
            plain_lyrics: None,
            synced_lyrics: None,
        };
        assert!(lrc.instrumental);
        assert!(lrc.plain_lyrics.is_none());
    }

    #[test]
    fn client_builds() {
        let client = build_client();
        let req = client.get("https://example.com").build();
        assert!(req.is_ok());
    }
}
