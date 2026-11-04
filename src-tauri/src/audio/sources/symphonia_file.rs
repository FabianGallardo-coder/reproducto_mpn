//! Local-file decoder built directly on symphonia.
//!
//! rodio 0.18 hands symphonia a media source without a byte length, which makes
//! the MP4 reader fail on fragmented M4A files (as produced by YouTube) and rodio
//! then panics with `unreachable!`. Opening the `File` directly gives symphonia
//! the real length, so those files decode and seek correctly.

use std::fs::File;
use std::path::Path;
use std::time::Duration;

use rodio::source::SeekError;
use rodio::Source;
use symphonia::core::audio::{SampleBuffer, SignalSpec};
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

const MAX_DECODE_RETRIES: usize = 3;

/// Extensions that must bypass rodio's built-in decoder.
pub fn needs_symphonia_file(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "m4a" | "mp4" | "aac"))
        .unwrap_or(false)
}

pub struct SymphoniaFileSource {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    track_id: u32,
    spec: SignalSpec,
    buffer: Option<SampleBuffer<i16>>,
    offset: usize,
    total_duration: Option<Duration>,
}

impl SymphoniaFileSource {
    pub fn open(path: &str) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("Cannot open: {e}"))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let probed = symphonia::default::get_probe()
            .format(
                &hint,
                mss,
                &FormatOptions {
                    enable_gapless: true,
                    ..Default::default()
                },
                &MetadataOptions::default(),
            )
            .map_err(|e| format!("Cannot decode: {e}"))?;
        let format = probed.format;

        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL && t.codec_params.sample_rate.is_some())
            .ok_or_else(|| "Cannot decode: no audio track".to_string())?;
        let track_id = track.id;
        let total_duration = track
            .codec_params
            .time_base
            .zip(track.codec_params.n_frames)
            .map(|(base, frames)| time_to_duration(base.calc_time(frames)));

        let decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &DecoderOptions::default())
            .map_err(|e| format!("Cannot decode: {e}"))?;

        let spec = SignalSpec::new(
            track.codec_params.sample_rate.unwrap_or(44_100),
            track
                .codec_params
                .channels
                .unwrap_or(symphonia::core::audio::Channels::FRONT_LEFT | symphonia::core::audio::Channels::FRONT_RIGHT),
        );

        let mut source = Self {
            format,
            decoder,
            track_id,
            spec,
            buffer: None,
            offset: 0,
            total_duration,
        };
        if !source.decode_next() {
            return Err("Cannot decode: no audio frames".into());
        }
        Ok(source)
    }

    /// Decodes the next packet of the selected track into `buffer`.
    /// Returns false at end of stream or on an unrecoverable error.
    fn decode_next(&mut self) -> bool {
        let mut errors = 0;
        loop {
            let packet = match self.format.next_packet() {
                Ok(p) => p,
                Err(_) => return false,
            };
            if packet.track_id() != self.track_id {
                continue;
            }
            match self.decoder.decode(&packet) {
                Ok(decoded) => {
                    if decoded.frames() == 0 {
                        continue;
                    }
                    self.spec = *decoded.spec();
                    let mut buf = SampleBuffer::<i16>::new(decoded.capacity() as u64, self.spec);
                    buf.copy_interleaved_ref(decoded);
                    self.buffer = Some(buf);
                    self.offset = 0;
                    return true;
                }
                Err(Error::DecodeError(_)) if errors < MAX_DECODE_RETRIES => {
                    errors += 1;
                }
                Err(_) => return false,
            }
        }
    }

    fn remaining_in_frame(&self) -> usize {
        self.buffer
            .as_ref()
            .map(|b| b.samples().len().saturating_sub(self.offset))
            .unwrap_or(0)
    }
}

fn time_to_duration(t: Time) -> Duration {
    Duration::from_secs(t.seconds) + Duration::from_secs_f64(t.frac.clamp(0.0, 0.999_999_999))
}

impl Iterator for SymphoniaFileSource {
    type Item = i16;

    fn next(&mut self) -> Option<i16> {
        if self.remaining_in_frame() == 0 && !self.decode_next() {
            return None;
        }
        let sample = self.buffer.as_ref()?.samples().get(self.offset).copied();
        self.offset += 1;
        sample
    }
}

impl Source for SymphoniaFileSource {
    fn current_frame_len(&self) -> Option<usize> {
        Some(self.remaining_in_frame())
    }

    fn channels(&self) -> u16 {
        self.spec.channels.count() as u16
    }

    fn sample_rate(&self) -> u32 {
        self.spec.rate
    }

    fn total_duration(&self) -> Option<Duration> {
        self.total_duration
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.format
            .seek(
                SeekMode::Accurate,
                SeekTo::Time {
                    time: Time::new(pos.as_secs(), f64::from(pos.subsec_nanos()) / 1e9),
                    track_id: Some(self.track_id),
                },
            )
            .map_err(|e| SeekError::Other(Box::new(e)))?;
        self.decoder.reset();
        self.buffer = None;
        self.offset = 0;
        self.decode_next();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_mp4_family_extensions() {
        assert!(needs_symphonia_file(r"C:\cache\abc.m4a"));
        assert!(needs_symphonia_file("/tmp/x.MP4"));
        assert!(needs_symphonia_file("song.aac"));
        assert!(!needs_symphonia_file("song.mp3"));
        assert!(!needs_symphonia_file("song"));
    }

    #[test]
    fn missing_file_is_an_error_not_a_panic() {
        assert!(SymphoniaFileSource::open(r"Z:\definitely\missing.m4a").is_err());
    }

    #[test]
    fn decodes_and_seeks_cached_youtube_m4a() {
        let Some(base) = std::env::var_os("LOCALAPPDATA") else {
            return;
        };
        let path = std::path::PathBuf::from(base).join(r"com.flowplayer.app\youtube\jNQXAC9IVRw.m4a");
        if !path.exists() {
            eprintln!("SKIP: {} not found", path.display());
            return;
        }
        let mut source = SymphoniaFileSource::open(path.to_str().unwrap()).expect("open m4a");
        assert!(source.sample_rate() > 0);
        assert!(source.channels() > 0);
        assert!(source.by_ref().take(10_000).count() == 10_000);
        source.try_seek(Duration::from_secs(5)).expect("seek");
        assert!(source.next().is_some());
    }
}
