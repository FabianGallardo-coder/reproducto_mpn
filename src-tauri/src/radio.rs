use std::collections::VecDeque;
use std::io::{Read, Seek, SeekFrom};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};

use serde::{Deserialize, Serialize};
use url::Url;

const MAX_HLS_DEPTH: u32 = 5;

#[derive(Debug, PartialEq, Eq)]
struct HlsSegment {
    sequence: u64,
    url: Url,
}

#[derive(Debug)]
struct HlsPlaylist {
    variants: Vec<Url>,
    segments: Vec<HlsSegment>,
    target_duration: std::time::Duration,
    end_list: bool,
}

fn is_hls_url(url: &Url) -> bool {
    url.path().to_ascii_lowercase().ends_with(".m3u8")
}

fn is_new_hls_segment(sequence: u64, previous_sequence: Option<u64>) -> bool {
    previous_sequence.is_none_or(|previous| sequence > previous)
}

fn parse_hls_playlist(base_url: &Url, body: &str) -> Result<HlsPlaylist, url::ParseError> {
    let mut variants = Vec::new();
    let mut segments = Vec::new();
    let mut sequence = 0;
    let mut target_duration = std::time::Duration::from_secs(2);
    let mut end_list = false;
    let mut next_line_is_variant = false;

    for line in body.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if let Some(value) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
            if let Ok(value) = value.parse::<u64>() {
                sequence = value;
            }
        } else if let Some(value) = line.strip_prefix("#EXT-X-TARGETDURATION:") {
            if let Ok(seconds) = value.parse::<u64>() {
                target_duration = std::time::Duration::from_secs(seconds.max(1));
            }
        } else if line.starts_with("#EXT-X-STREAM-INF:") {
            next_line_is_variant = true;
        } else if line == "#EXT-X-ENDLIST" {
            end_list = true;
        } else if !line.starts_with('#') {
            let resolved = base_url.join(line)?;
            if next_line_is_variant {
                variants.push(resolved);
                next_line_is_variant = false;
            } else {
                segments.push(HlsSegment {
                    sequence,
                    url: resolved,
                });
                sequence = sequence.saturating_add(1);
            }
        }
    }

    Ok(HlsPlaylist {
        variants,
        segments,
        target_duration,
        end_list,
    })
}

async fn fetch_hls_playlist(
    client: &reqwest::Client,
    mut playlist_url: Url,
    cancelled: &AtomicBool,
) -> Result<(Url, HlsPlaylist), String> {
    for _ in 0..MAX_HLS_DEPTH {
        if cancelled.load(Ordering::Relaxed) {
            return Err("HLS playback cancelled".into());
        }

        let response = client
            .get(playlist_url.clone())
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|error| error.to_string())?;
        let body = response.text().await.map_err(|error| error.to_string())?;
        let playlist =
            parse_hls_playlist(&playlist_url, &body).map_err(|error| error.to_string())?;

        if let Some(variant_url) = playlist.variants.first() {
            playlist_url = variant_url.clone();
        } else {
            return Ok((playlist_url, playlist));
        }
    }

    Err("HLS variant playlist nesting exceeds the supported depth".into())
}

async fn forward_response(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| error.to_string())?;

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        if cancelled.load(Ordering::Relaxed) {
            return Ok(());
        }

        let bytes = chunk.map_err(|error| error.to_string())?;
        loop {
            if cancelled.load(Ordering::Relaxed) {
                return Ok(());
            }
            let buffered = shared.lock().map(|buffer| buffer.len()).unwrap_or(0);
            if buffered < BUFFER_HIGH_WATERMARK {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        if tx.send(bytes.to_vec()).is_err() {
            return Ok(());
        }
    }

    Ok(())
}

async fn forward_hls(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) {
    let mut previous_sequence = None;

    while !cancelled.load(Ordering::Relaxed) {
        let (_playlist_url, playlist) =
            match fetch_hls_playlist(client, url.clone(), cancelled).await {
                Ok(playlist) => playlist,
                Err(error) => {
                    if !cancelled.load(Ordering::Relaxed) {
                        log::warn!("[stream] HLS playlist request failed: {error}");
                    }
                    return;
                }
            };

        for segment in playlist.segments {
            if !is_new_hls_segment(segment.sequence, previous_sequence) {
                continue;
            }

            if let Err(error) = forward_response(client, segment.url, tx, shared, cancelled).await {
                if !cancelled.load(Ordering::Relaxed) {
                    log::warn!("[stream] HLS segment request failed: {error}");
                }
                return;
            }
            previous_sequence = Some(segment.sequence);
        }

        if playlist.end_list {
            return;
        }

        let interval = playlist.target_duration;
        let mut slept = std::time::Duration::ZERO;
        while slept < interval && !cancelled.load(Ordering::Relaxed) {
            let step = (interval - slept).min(std::time::Duration::from_millis(200));
            tokio::time::sleep(step).await;
            slept += step;
        }
    }
}

async fn forward_direct_stream(
    client: &reqwest::Client,
    url: Url,
    tx: &mpsc::Sender<Vec<u8>>,
    shared: &Arc<Mutex<RingBuffer>>,
    cancelled: &AtomicBool,
) {
    const MAX_ATTEMPTS: u32 = 3;
    for attempt in 0..MAX_ATTEMPTS {
        if cancelled.load(Ordering::Relaxed) {
            return;
        }
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000 * attempt as u64)).await;
        }

        match forward_response(client, url.clone(), tx, shared, cancelled).await {
            Ok(()) => return,
            Err(error) => {
                if !cancelled.load(Ordering::Relaxed) {
                    log::warn!("[stream] attempt {attempt}: request failed: {error}");
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadioStation {
    pub name: String,
    pub genre: String,
    pub url: String,
    pub description: String,
}

pub fn preset_stations() -> Result<Vec<RadioStation>, serde_json::Error> {
    serde_json::from_str(include_str!("../radio/stations.json"))
}

// Thresholds for backpressure (in bytes)
const BUFFER_HIGH_WATERMARK: usize = 1_500_000; // pause download above 1.5 MB
const BUFFER_LOW_WATERMARK: usize = 1_000_000; // resume download below 1.0 MB

struct RingBuffer {
    buf: VecDeque<u8>,
    max_size: usize,
}

impl RingBuffer {
    fn new(max_size: usize) -> Self {
        Self {
            buf: VecDeque::with_capacity(max_size.min(1024 * 1024)),
            max_size,
        }
    }

    fn push(&mut self, data: &[u8]) {
        self.buf.extend(data.iter());
        if self.buf.len() > self.max_size {
            self.buf.drain(..self.buf.len() - self.max_size);
        }
    }

    fn read_from(&mut self, dest: &mut [u8]) -> usize {
        let n = dest.len().min(self.buf.len());
        for byte in &mut dest[..n] {
            *byte = self.buf.pop_front().unwrap_or(0);
        }
        n
    }

    fn len(&self) -> usize {
        self.buf.len()
    }
}

pub struct StreamReader {
    rx: Mutex<mpsc::Receiver<Vec<u8>>>,
    shared: Arc<Mutex<RingBuffer>>,
    /// Condvar used to wake the downloader when buffer drains below low watermark
    drain_signal: Arc<(Mutex<bool>, Condvar)>,
    pos: u64,
    /// Cancellation token to stop the download thread
    cancelled: Arc<AtomicBool>,
}

impl StreamReader {
    pub fn new(url: &str) -> Self {
        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        let shared = Arc::new(Mutex::new(RingBuffer::new(4 * 1024 * 1024))); // 4 MB ring
        let drain_signal = Arc::new((Mutex::new(false), Condvar::new()));
        let cancelled = Arc::new(AtomicBool::new(false)); // Cancellation token
        let url = url.to_string();

        let shared_dl = Arc::clone(&shared);
        let cancelled_dl = Arc::clone(&cancelled);

        tauri::async_runtime::spawn(async move {
            let client = reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .user_agent("FlowPlayer/0.1")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new());

            match Url::parse(&url) {
                Ok(parsed) if is_hls_url(&parsed) => {
                    forward_hls(&client, parsed, &tx, &shared_dl, &cancelled_dl).await;
                }
                Ok(parsed) => {
                    forward_direct_stream(&client, parsed, &tx, &shared_dl, &cancelled_dl).await;
                }
                Err(error) => {
                    log::warn!("[stream] invalid URL: {error}");
                }
            }
        });

        Self {
            rx: Mutex::new(rx),
            shared,
            drain_signal,
            pos: 0,
            cancelled,
        }
    }
}

impl Read for StreamReader {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        // Drain chunks from the channel into the ring buffer
        if let Ok(rx) = self.rx.lock() {
            while let Ok(chunk) = rx.try_recv() {
                if let Ok(mut rb) = self.shared.lock() {
                    rb.push(&chunk);
                }
            }
        }

        // Try to serve from the ring buffer
        if let Ok(mut rb) = self.shared.lock() {
            let n = rb.read_from(buf);
            if n > 0 {
                self.pos += n as u64;
                // --- BACKPRESSURE: notify downloader when buffer drains below low watermark ---
                if rb.len() < BUFFER_LOW_WATERMARK {
                    let (lock, cvar) = &*self.drain_signal;
                    if let Ok(mut paused) = lock.lock() {
                        *paused = false;
                        cvar.notify_one();
                    }
                }
                // ---------------------------------------------------------------------------
                return Ok(n);
            }
        }

        // Buffer empty: wait for data with timeout to avoid blocking the audio thread indefinitely.
        if let Ok(rx) = self.rx.lock() {
            match rx.recv_timeout(std::time::Duration::from_secs(5)) {
                Ok(chunk) => {
                    if let Ok(mut rb) = self.shared.lock() {
                        rb.push(&chunk);
                        let n = rb.read_from(buf);
                        self.pos += n as u64;
                        if rb.len() < BUFFER_LOW_WATERMARK {
                            let (lock, cvar) = &*self.drain_signal;
                            if let Ok(mut paused) = lock.lock() {
                                *paused = false;
                                cvar.notify_one();
                            }
                        }
                        return Ok(n);
                    }
                }
                Err(_) => {
                    log::debug!("[stream] recv timeout or channel closed");
                }
            }
        }

        Err(std::io::Error::new(
            std::io::ErrorKind::UnexpectedEof,
            "stream ended",
        ))
    }
}

impl Seek for StreamReader {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        match pos {
            SeekFrom::Current(0) => Ok(self.pos),
            SeekFrom::Current(offset) => {
                self.pos = self.pos.saturating_add_signed(offset);
                Ok(self.pos)
            }
            SeekFrom::Start(p) => {
                self.pos = p;
                Ok(self.pos)
            }
            SeekFrom::End(_) => Ok(self.pos),
        }
    }
}

impl Drop for StreamReader {
    fn drop(&mut self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_buffer_push_and_read() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"hello");
        let mut out = [0u8; 5];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 5);
        assert_eq!(&out, b"hello");
    }

    #[test]
    fn ring_buffer_evicts_oldest() {
        let mut rb = RingBuffer::new(10);
        rb.push(b"1234567890abcdef");
        assert!(rb.len() <= 10);
        let mut out = [0u8; 10];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 10);
        assert_eq!(&out, b"7890abcdef");
    }

    #[test]
    fn ring_buffer_read_empty() {
        let mut rb = RingBuffer::new(10);
        let mut out = [0u8; 5];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 0);
    }

    #[test]
    fn ring_buffer_partial_read() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"hi");
        let mut out = [0u8; 10];
        let n = rb.read_from(&mut out);
        assert_eq!(n, 2);
        assert_eq!(&out[..2], b"hi");
    }

    #[test]
    fn ring_buffer_push_drains_correctly() {
        let mut rb = RingBuffer::new(5);
        rb.push(b"abcde");
        assert_eq!(rb.len(), 5);
        rb.push(b"fghij");
        assert_eq!(rb.len(), 5);
        let mut out = [0u8; 5];
        rb.read_from(&mut out);
        assert_eq!(&out, b"fghij");
    }

    #[test]
    fn seek_current_zero_returns_pos() {
        let mut rb = RingBuffer::new(100);
        rb.push(b"data");
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 42,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(0)).unwrap(), 42);
    }

    #[test]
    fn seek_start_sets_pos() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 0,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Start(100)).unwrap(), 100);
        assert_eq!(sr.pos, 100);
    }

    #[test]
    fn seek_current_positive_offset() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 10,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(5)).unwrap(), 15);
    }

    #[test]
    fn seek_current_negative_saturates() {
        let rb = RingBuffer::new(100);
        let mut sr = StreamReader {
            rx: Mutex::new({
                let (tx, rx) = mpsc::channel();
                let _ = tx;
                rx
            }),
            shared: Arc::new(Mutex::new(rb)),
            drain_signal: Arc::new((Mutex::new(false), Condvar::new())),
            pos: 3,
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        assert_eq!(sr.seek(SeekFrom::Current(-10)).unwrap(), 0);
    }

    #[test]
    fn preset_stations_not_empty() {
        let stations = preset_stations().unwrap();
        assert_eq!(stations.len(), 92);
        assert_eq!(stations[0].name, "Groove Salad");
        assert_eq!(stations[8].name, "Radio Madre (530 AM)");
        assert_eq!(stations[91].name, "LU2 Radio Bahía Blanca (840 AM)");
        for name in [
            "Radio Mitre (790 AM)",
            "Radio 10 (710 AM)",
            "Radio Nacional (870 AM)",
            "Cosmos FM",
        ] {
            assert!(stations.iter().any(|station| station.name == name), "{name}");
        }
    }

    #[test]
    fn preset_stations_have_urls() {
        let stations = preset_stations().unwrap();
        let mut names = std::collections::HashSet::new();
        for s in &stations {
            let url = Url::parse(&s.url).unwrap();
            assert!(matches!(url.scheme(), "http" | "https"), "{}", s.name);
            assert!(url.host_str().is_some(), "{}", s.name);
            assert!(!s.name.is_empty(), "station has no name");
            assert!(!s.genre.is_empty(), "station {} has no genre", s.name);
            assert!(!s.description.is_empty(), "station {} has no description", s.name);
            assert!(names.insert(&s.name), "duplicate station name: {}", s.name);
        }
    }

    #[test]
    fn preset_http_stations_match_android_cleartext_exceptions() {
        let policy = include_str!(
            "../gen/android/app/src/main/res/xml/network_security_config.xml"
        );
        assert!(policy.contains("<base-config cleartextTrafficPermitted=\"false\" />"));
        let allowed_hosts: std::collections::HashSet<_> = policy
            .lines()
            .filter_map(|line| {
                line.trim()
                    .strip_prefix("<domain includeSubdomains=\"false\">")?
                    .strip_suffix("</domain>")
            })
            .collect();
        let http_hosts: std::collections::HashSet<_> = preset_stations()
            .unwrap()
            .iter()
            .map(|station| Url::parse(&station.url).unwrap())
            .filter(|url| url.scheme() == "http")
            .map(|url| url.host_str().unwrap().to_string())
            .collect();
        assert_eq!(http_hosts.len(), 6);
        assert_eq!(
            http_hosts,
            allowed_hosts.into_iter().map(str::to_owned).collect()
        );
    }

    #[test]
    fn hls_playlist_resolves_relative_segments_and_media_sequence() {
        let playlist_url = Url::parse("https://radio.example/live/index.m3u8").unwrap();
        let playlist = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:12\n#EXTINF:4,\nseg-12.ts\n#EXTINF:4,\nseg-13.ts\n",
        )
        .unwrap();

        assert_eq!(playlist.segments.len(), 2);
        assert_eq!(playlist.segments[0].sequence, 12);
        assert_eq!(
            playlist.segments[0].url.as_str(),
            "https://radio.example/live/seg-12.ts"
        );
        assert_eq!(playlist.segments[1].sequence, 13);
        assert_eq!(
            playlist.segments[1].url.as_str(),
            "https://radio.example/live/seg-13.ts"
        );
        assert!(!playlist.end_list);
    }

    #[test]
    fn reloaded_hls_playlist_skips_consumed_segments_and_yields_new_ones() {
        let playlist_url = Url::parse("https://radio.example/live/index.m3u8").unwrap();
        let first = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:20\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n",
        )
        .unwrap();
        let last_consumed = first.segments.last().map(|segment| segment.sequence);
        let reloaded = parse_hls_playlist(
            &playlist_url,
            "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:20\n#EXTINF:4,\na.ts\n#EXTINF:4,\nb.ts\n#EXTINF:4,\nc.ts\n",
        )
        .unwrap();

        let new_segments: Vec<_> = reloaded
            .segments
            .iter()
            .filter(|segment| is_new_hls_segment(segment.sequence, last_consumed))
            .collect();

        assert_eq!(new_segments.len(), 1);
        assert_eq!(
            new_segments[0].url.as_str(),
            "https://radio.example/live/c.ts"
        );
    }
}
