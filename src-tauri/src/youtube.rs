pub fn is_youtube_url(url: &str) -> bool {
    if let Ok(parsed) = url::Url::parse(url) {
        if !matches!(parsed.scheme(), "http" | "https") { return false; }
        matches!(parsed.host_str(), Some("www.youtube.com" | "youtube.com" | "youtu.be"))
    } else {
        false
    }
}

pub(crate) fn summarize_stderr(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let line = text
        .lines()
        .rev()
        .find(|l| l.contains("ERROR"))
        .or_else(|| text.lines().rev().find(|l| !l.trim().is_empty()))
        .unwrap_or("")
        .trim();
    line.chars().take(200).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn youtube_urls_accepted() {
        assert!(is_youtube_url(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ));
        assert!(is_youtube_url("https://youtube.com/watch?v=abc"));
        assert!(is_youtube_url("https://youtu.be/dQw4w9WgXcQ"));
        assert!(is_youtube_url("http://www.youtube.com/watch?v=123"));
        assert!(is_youtube_url("https://YouTube.COM/watch?v=123"));
    }

    #[test]
    fn non_youtube_urls_rejected() {
        assert!(!is_youtube_url("https://vimeo.com/123"));
        assert!(!is_youtube_url("https://soundcloud.com/track"));
        assert!(!is_youtube_url(
            "https://www.youtube-nocookie.com/embed/123"
        ));
        assert!(!is_youtube_url("https://www.notyoutube.com/watch?v=123"));
        assert!(!is_youtube_url("not a url"));
        assert!(!is_youtube_url(""));
    }

    #[test]
    fn youtube_with_path_variations() {
        assert!(is_youtube_url("https://www.youtube.com/shorts/abc123"));
        assert!(is_youtube_url("https://www.youtube.com/live/abc123"));
        assert!(is_youtube_url("https://www.youtube.com/embed/abc123"));
        assert!(is_youtube_url("https://www.youtube.com/channel/UC123"));
    }

    #[test]
    fn scheme_variations() {
        assert!(is_youtube_url("https://youtu.be/abc"));
        assert!(is_youtube_url("http://youtu.be/abc"));
        assert!(!is_youtube_url("ftp://youtu.be/abc"));
    }
}
