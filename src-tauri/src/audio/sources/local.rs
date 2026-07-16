pub fn is_supported(path: &str) -> bool {
    matches!(
        path.rsplit('.').next().map(|e| e.to_lowercase()).as_deref(),
        Some("mp3" | "flac" | "wav" | "ogg" | "aac" | "m4a")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supported_formats() {
        assert!(is_supported("song.mp3"));
        assert!(is_supported("track.FLAC"));
        assert!(is_supported("recording.wav"));
        assert!(is_supported("audio.ogg"));
        assert!(is_supported("podcast.aac"));
        assert!(is_supported("clip.m4a"));
    }

    #[test]
    fn unsupported_formats() {
        assert!(!is_supported("image.png"));
        assert!(!is_supported("video.mp4"));
        assert!(!is_supported("doc.txt"));
        assert!(!is_supported("noext"));
    }
}
