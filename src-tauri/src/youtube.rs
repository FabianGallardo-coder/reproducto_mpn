use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct YouTubeMeta {
    pub title: String,
    pub artist: String,
    pub duration: f64,
    pub thumbnail: String,
    pub stream_url: String,
}

pub fn is_youtube_url(url: &str) -> bool {
    url.starts_with("https://www.youtube.com/")
        || url.starts_with("https://youtube.com/")
        || url.starts_with("https://youtu.be/")
        || url.starts_with("http://www.youtube.com/")
        || url.starts_with("http://youtube.com/")
        || url.starts_with("http://youtu.be/")
}

pub fn fetch_metadata(url: &str) -> Result<YouTubeMeta, String> {
    if !is_youtube_url(url) {
        return Err("URL is not a YouTube link".into());
    }
    let output = std::process::Command::new("yt-dlp")
        .args([
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            "--",
            url,
        ])
        .output()
        .map_err(|e| format!("yt-dlp not found: {e}. Install with: pip install yt-dlp"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {stderr}"));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse yt-dlp output: {e}"))?;

    Ok(YouTubeMeta {
        title: json["title"].as_str().unwrap_or("Unknown").to_string(),
        artist: json["uploader"].as_str().unwrap_or("Unknown").to_string(),
        duration: json["duration"].as_f64().unwrap_or(0.0),
        thumbnail: json["thumbnail"].as_str().unwrap_or("").to_string(),
        stream_url: String::new(), // filled separately via -f bestaudio
    })
}

pub fn get_audio_stream_url(url: &str) -> Result<String, String> {
    if !is_youtube_url(url) {
        return Err("URL is not a YouTube link".into());
    }

    let output = std::process::Command::new("yt-dlp")
        .args([
            "-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            "-g",
            "--no-playlist",
            "--no-warnings",
            "--",
            url,
        ])
        .output()
        .map_err(|e| format!("yt-dlp not found: {e}. Install with: pip install yt-dlp"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {stderr}"));
    }

    let stream_url = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid output: {e}"))?
        .trim()
        .to_string();

    if stream_url.is_empty() {
        return Err("No stream URL returned".into());
    }

    Ok(stream_url)
}
