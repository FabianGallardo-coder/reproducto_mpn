use std::collections::VecDeque;
use std::io::BufReader;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};

use rodio::cpal::{
    self,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use rodio::{Decoder, Sink, Source};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f32,
    pub current_track: Option<String>,
}

pub enum AudioCommand {
    PlayFile(String),
    PlayUrl(String),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    Seek(Duration),
    #[cfg(test)]
    SimulateOutputLoss,
}

pub enum AudioEvent {
    TrackEnded,
    Error(String),
    OutputRecovered,
}

pub struct AudioPlayer {
    tx: mpsc::Sender<AudioCommand>,
    shared: Arc<SharedState>,
}

struct SharedState {
    playing: std::sync::atomic::AtomicBool,
    volume: AtomicU64,
    position: AtomicU64,
    duration: AtomicU64,
    current_track: std::sync::Mutex<Option<String>>,
}

struct AmplitudeMonitor<I: Source<Item = i16>> {
    input: I,
    amplitude_buf: Arc<Mutex<VecDeque<f32>>>,
    local_accumulator: f32,
    local_count: usize,
}

impl<I: Source<Item = i16>> Iterator for AmplitudeMonitor<I> {
    type Item = i16;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.input.next()?;
        let amp = (sample as f32 / i16::MAX as f32).abs();

        self.local_accumulator = self.local_accumulator.max(amp);
        self.local_count += 1;

        if self.local_count >= 512 {
            if let Ok(mut buf) = self.amplitude_buf.lock() {
                if buf.len() >= 64 {
                    buf.pop_front();
                }
                buf.push_back(self.local_accumulator);
            }
            self.local_accumulator = 0.0;
            self.local_count = 0;
        }
        Some(sample)
    }
}

impl<I: Source<Item = i16>> Source for AmplitudeMonitor<I> {
    fn current_frame_len(&self) -> Option<usize> {
        self.input.current_frame_len()
    }

    fn channels(&self) -> u16 {
        self.input.channels()
    }

    fn sample_rate(&self) -> u32 {
        self.input.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.input.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), rodio::source::SeekError> {
        self.input.try_seek(pos)
    }
}

fn f64_to_u64(v: f64) -> u64 {
    v.to_bits()
}

type BoxedSource = Box<dyn Source<Item = i16> + Send>;

// Keep the decoder queue alive independently of a Windows output stream. A lost
// endpoint can then be replaced without reopening a file or a live radio stream.
#[derive(Clone)]
struct SharedOutput(
    Arc<Mutex<rodio::source::UniformSourceIterator<rodio::queue::SourcesQueueOutput<f32>, f32>>>,
);

impl Iterator for SharedOutput {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        self.0
            .lock()
            .unwrap_or_else(|error| {
                log::error!("Audio output queue poisoned: {error}");
                error.into_inner()
            })
            .next()
    }
}

impl Source for SharedOutput {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }
    fn channels(&self) -> u16 {
        2
    }
    fn sample_rate(&self) -> u32 {
        48_000
    }
    fn total_duration(&self) -> Option<Duration> {
        None
    }
}

fn replace_sink(output: &SharedOutput, volume: f32) -> Sink {
    let (sink, queue) = Sink::new_idle();
    sink.set_volume(volume);
    *output.0.lock().unwrap_or_else(|error| {
        log::error!("Audio output queue poisoned while replacing track: {error}");
        error.into_inner()
    }) = rodio::source::UniformSourceIterator::new(queue, 2, 48_000);
    sink
}

fn build_output<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    output: SharedOutput,
    errors: mpsc::Sender<String>,
) -> Result<cpal::Stream, String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let mut source = rodio::source::UniformSourceIterator::<_, f32>::new(
        output,
        config.channels,
        config.sample_rate.0,
    );
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                for sample in data {
                    *sample = T::from_sample(source.next().unwrap_or(0.0));
                }
            },
            move |error| {
                let _ = errors.send(error.to_string());
            },
            None,
        )
        .map_err(|e| e.to_string())
}

fn connect_output(
    output: SharedOutput,
    errors: mpsc::Sender<String>,
) -> Result<(cpal::Stream, String), String> {
    let device = cpal::default_host()
        .default_output_device()
        .ok_or("No default audio output device")?;
    let name = device.name().map_err(|e| e.to_string())?;
    let format = device.default_output_config().map_err(|e| e.to_string())?;
    let config = format.config();
    let stream = match format.sample_format() {
        cpal::SampleFormat::F32 => build_output::<f32>(&device, &config, output, errors),
        cpal::SampleFormat::F64 => build_output::<f64>(&device, &config, output, errors),
        cpal::SampleFormat::I8 => build_output::<i8>(&device, &config, output, errors),
        cpal::SampleFormat::I16 => build_output::<i16>(&device, &config, output, errors),
        cpal::SampleFormat::I32 => build_output::<i32>(&device, &config, output, errors),
        cpal::SampleFormat::I64 => build_output::<i64>(&device, &config, output, errors),
        cpal::SampleFormat::U8 => build_output::<u8>(&device, &config, output, errors),
        cpal::SampleFormat::U16 => build_output::<u16>(&device, &config, output, errors),
        cpal::SampleFormat::U32 => build_output::<u32>(&device, &config, output, errors),
        cpal::SampleFormat::U64 => build_output::<u64>(&device, &config, output, errors),
        other => Err(format!("Unsupported output sample format: {other}")),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    Ok((stream, name))
}

#[derive(Default)]
struct PlaybackIntent {
    requested: bool,
    connected: bool,
}

impl PlaybackIntent {
    fn playing(&self) -> bool {
        self.requested && self.connected
    }
}

/// Opens a local audio file. Decoder panics (rodio uses `unreachable!` for some
/// malformed inputs) are converted into errors so the audio thread survives.
fn open_local_source(path: &str) -> Result<BoxedSource, String> {
    use crate::audio::sources::symphonia_file::{needs_symphonia_file, SymphoniaFileSource};

    let path = path.to_string();
    std::panic::catch_unwind(move || -> Result<BoxedSource, String> {
        if needs_symphonia_file(&path) {
            return SymphoniaFileSource::open(&path).map(|s| Box::new(s) as BoxedSource);
        }
        let file = std::fs::File::open(&path).map_err(|e| format!("Cannot open: {e}"))?;
        Decoder::new(BufReader::new(file))
            .map(|s| Box::new(s) as BoxedSource)
            .map_err(|e| format!("Cannot decode: {e}"))
    })
    .unwrap_or_else(|_| Err("Cannot decode: unsupported or corrupt file".into()))
}

fn u64_to_f64(v: u64) -> f64 {
    f64::from_bits(v)
}

/// Playback position derived from wall-clock time that does not advance while
/// paused, so the UI can never report more time than was actually played.
struct PlaybackClock {
    started: Instant,
    paused_at: Option<Instant>,
}

impl PlaybackClock {
    fn new() -> Self {
        Self {
            started: Instant::now(),
            paused_at: None,
        }
    }

    fn restart(&mut self) {
        self.started = Instant::now();
        self.paused_at = None;
    }

    fn position(&self, now: Instant) -> f64 {
        let end = self.paused_at.unwrap_or(now);
        end.saturating_duration_since(self.started).as_secs_f64()
    }

    fn pause(&mut self, now: Instant) {
        self.paused_at.get_or_insert(now);
    }

    fn resume(&mut self, now: Instant) {
        if let Some(paused_at) = self.paused_at.take() {
            self.started += now.saturating_duration_since(paused_at);
        }
    }

    fn seek(&mut self, position: f64, now: Instant) {
        let offset = Duration::from_secs_f64(position.max(0.0));
        self.started = now.checked_sub(offset).unwrap_or(now);
        if self.paused_at.is_some() {
            self.paused_at = Some(now);
        }
    }
}

impl AudioPlayer {
    pub fn new(
        analyzer_buf: Arc<Mutex<VecDeque<f32>>>,
    ) -> Result<(Self, mpsc::Receiver<AudioEvent>), AppError> {
        let (cmd_tx, cmd_rx) = mpsc::channel::<AudioCommand>();
        let (event_tx, event_rx) = mpsc::channel::<AudioEvent>();
        let (init_tx, init_rx) = mpsc::channel::<Result<(), String>>();

        let shared = Arc::new(SharedState {
            playing: std::sync::atomic::AtomicBool::new(false),
            volume: AtomicU64::new(f64_to_u64(0.8)),
            position: AtomicU64::new(f64_to_u64(0.0)),
            duration: AtomicU64::new(f64_to_u64(0.0)),
            current_track: std::sync::Mutex::new(None),
        });

        let shared_clone = Arc::clone(&shared);
        let analyzer_buf_clone = Arc::clone(&analyzer_buf);

        std::thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || {
                let (mut sink, queue) = Sink::new_idle();
                let output = SharedOutput(Arc::new(Mutex::new(
                    rodio::source::UniformSourceIterator::new(queue, 2, 48_000),
                )));
                let (output_error_tx, output_error_rx) = mpsc::channel();
                let (stream, mut device_name) =
                    match connect_output(output.clone(), output_error_tx.clone()) {
                        Ok(connection) => connection,
                        Err(e) => {
                            let _ = init_tx.send(Err(format!("Audio output: {e}")));
                            return;
                        }
                    };

                sink.set_volume(0.8);
                let _ = init_tx.send(Ok(()));
                let mut stream = Some(stream);
                let mut intent = PlaybackIntent {
                    requested: false,
                    connected: true,
                };
                let mut playback_clock = PlaybackClock::new();
                let mut next_retry = Instant::now();
                let mut next_device_check = Instant::now();

                loop {
                    let now = Instant::now();
                    let output_error = output_error_rx.try_recv().ok();
                    let device_error = if now >= next_device_check {
                        next_device_check = now + Duration::from_secs(1);
                        match cpal::default_host().default_output_device() {
                            Some(device) => match device.name() {
                                Ok(name) if name != device_name => {
                                    Some("Default audio output changed".into())
                                }
                                Ok(_) => None,
                                Err(error) => Some(format!("Cannot inspect audio output: {error}")),
                            },
                            None => Some("No default audio output device".into()),
                        }
                    } else {
                        None
                    };
                    if let Some(reason) = output_error.or(device_error).filter(|_| intent.connected)
                    {
                        log::warn!("Audio output disconnected: {reason}");
                        intent.connected = false;
                        sink.pause();
                        playback_clock.pause(now);
                        shared_clone.playing.store(false, Ordering::Relaxed);
                        stream.take();
                        for error in output_error_rx.try_iter() {
                            log::warn!("Previous audio output error: {error}");
                        }
                        if let Ok(mut buf) = analyzer_buf_clone.lock() {
                            buf.clear();
                        }
                        let _ = event_tx.send(AudioEvent::Error(format!(
                            "Audio output lost: {reason}. Reconnecting to the default device."
                        )));
                        next_retry = now;
                    }
                    if !intent.connected && now >= next_retry {
                        next_retry = now + Duration::from_secs(1);
                        match connect_output(output.clone(), output_error_tx.clone()) {
                            Ok((new_stream, name)) => {
                                stream = Some(new_stream);
                                device_name = name;
                                intent.connected = true;
                                log::info!("Audio output reconnected: {device_name}");
                                let _ = event_tx.send(AudioEvent::OutputRecovered);
                            }
                            Err(error) => log::warn!("Audio output reconnect failed: {error}"),
                        }
                    }
                    let command = match cmd_rx.recv_timeout(Duration::from_millis(100)) {
                        Ok(command) => Some(command),
                        Err(mpsc::RecvTimeoutError::Timeout) => None,
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    };
                    if let Some(cmd) = command {
                        match cmd {
                            #[cfg(test)]
                            AudioCommand::SimulateOutputLoss => {
                                let _ = output_error_tx.send("Simulated output device loss".into());
                            }
                            AudioCommand::PlayFile(path) => {
                                let source = match open_local_source(&path) {
                                    Ok(s) => s,
                                    Err(e) => {
                                        log::warn!("PlayFile FAILED: {e}");
                                        let _ = event_tx.send(AudioEvent::Error(e));
                                        continue;
                                    }
                                };

                                let dur = source.total_duration().unwrap_or_default().as_secs_f64();
                                shared_clone
                                    .duration
                                    .store(f64_to_u64(dur), Ordering::Relaxed);
                                shared_clone
                                    .position
                                    .store(f64_to_u64(0.0), Ordering::Relaxed);

                                sink.stop();
                                sink = replace_sink(&output, sink.volume());
                                let monitored = AmplitudeMonitor {
                                    input: source,
                                    amplitude_buf: Arc::clone(&analyzer_buf_clone),
                                    local_accumulator: 0.0,
                                    local_count: 0,
                                };
                                sink.append(monitored);
                                sink.play();
                                if let Ok(mut track) = shared_clone.current_track.lock() {
                                    *track = Some(path);
                                }

                                intent.requested = true;
                                playback_clock.restart();
                            }
                            AudioCommand::PlayUrl(url) => {
                                log::debug!("PlayUrl: {url}");
                                let stream = crate::radio::StreamReader::new(&url);

                                let source = match std::panic::catch_unwind(
                                    std::panic::AssertUnwindSafe(|| Decoder::new(stream)),
                                ) {
                                    Ok(Ok(s)) => s,
                                    Ok(Err(e)) => {
                                        log::warn!("PlayUrl FAILED decode: {e}");
                                        let _ = event_tx.send(AudioEvent::Error(format!(
                                            "Cannot decode stream: {e}"
                                        )));
                                        continue;
                                    }
                                    Err(_) => {
                                        let _ = event_tx.send(AudioEvent::Error(
                                            "Cannot decode stream: unsupported format".into(),
                                        ));
                                        continue;
                                    }
                                };

                                shared_clone
                                    .duration
                                    .store(f64_to_u64(0.0), Ordering::Relaxed);
                                shared_clone
                                    .position
                                    .store(f64_to_u64(0.0), Ordering::Relaxed);

                                sink.stop();
                                sink = replace_sink(&output, sink.volume());
                                let monitored = AmplitudeMonitor {
                                    input: source,
                                    amplitude_buf: Arc::clone(&analyzer_buf_clone),
                                    local_accumulator: 0.0,
                                    local_count: 0,
                                };
                                sink.append(monitored);
                                sink.play();
                                if let Ok(mut track) = shared_clone.current_track.lock() {
                                    *track = Some(url);
                                }
                                playback_clock.restart();
                                intent.requested = true;
                            }
                            AudioCommand::Pause => {
                                log::debug!("Pause");
                                sink.pause();
                                playback_clock.pause(Instant::now());
                                intent.requested = false;
                            }
                            AudioCommand::Resume => {
                                log::debug!("Resume");
                                sink.play();
                                playback_clock.resume(Instant::now());
                                intent.requested = !sink.empty();
                            }
                            AudioCommand::Stop => {
                                log::debug!("Stop");
                                sink.stop();
                                intent.requested = false;
                                shared_clone
                                    .position
                                    .store(f64_to_u64(0.0), Ordering::Relaxed);
                            }
                            AudioCommand::SetVolume(v) => {
                                sink.set_volume(v);
                                shared_clone
                                    .volume
                                    .store(f64_to_u64(v as f64), Ordering::Relaxed);
                            }
                            AudioCommand::Seek(pos) => {
                                log::debug!("Seek to {}s", pos.as_secs_f64());
                                if !intent.connected {
                                    let _ = event_tx.send(AudioEvent::Error(
                                        "Cannot seek while the audio output is disconnected".into(),
                                    ));
                                    continue;
                                }
                                match sink.try_seek(pos) {
                                    Ok(_) => {
                                        playback_clock.seek(pos.as_secs_f64(), Instant::now());
                                        shared_clone.position.store(
                                            f64_to_u64(pos.as_secs_f64()),
                                            Ordering::Relaxed,
                                        );
                                    }
                                    Err(e) => {
                                        log::warn!("Seek failed: {e}");
                                        let _ = event_tx
                                            .send(AudioEvent::Error(format!("Seek failed: {e}")));
                                    }
                                }
                            }
                        }
                    }
                    let now = Instant::now();
                    if intent.playing() && sink.empty() {
                        intent.requested = false;
                        let _ = event_tx.send(AudioEvent::TrackEnded);
                    }
                    if intent.playing() {
                        sink.play();
                    } else {
                        sink.pause();
                    }
                    if intent.playing() {
                        playback_clock.resume(now);
                    } else {
                        playback_clock.pause(now);
                    }
                    if intent.requested {
                        let duration = u64_to_f64(shared_clone.duration.load(Ordering::Relaxed));
                        let position = playback_clock.position(now);
                        shared_clone.position.store(
                            f64_to_u64(if duration > 0.0 {
                                position.min(duration)
                            } else {
                                position
                            }),
                            Ordering::Relaxed,
                        );
                    }
                    shared_clone
                        .playing
                        .store(intent.playing(), Ordering::Relaxed);
                }
            })
            .map_err(|e| AppError::Audio(format!("Spawn audio thread: {e}")))?;

        init_rx
            .recv()
            .map_err(|_| AppError::Audio("Init channel dropped".into()))?
            .map_err(AppError::Audio)?;

        let player = Self { tx: cmd_tx, shared };

        Ok((player, event_rx))
    }

    pub fn play_file(&self, path: &str) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::PlayFile(path.to_string()))
            .map_err(|e| AppError::Audio(e.to_string()))?;
        Ok(())
    }

    pub fn play_url(&self, url: &str) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::PlayUrl(url.to_string()))
            .map_err(|e| AppError::Audio(e.to_string()))?;
        Ok(())
    }

    pub fn pause(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Pause)
            .map_err(|e| AppError::Audio(e.to_string()))
    }

    pub fn resume(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Resume)
            .map_err(|e| AppError::Audio(e.to_string()))
    }

    pub fn stop(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Stop)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        *self
            .shared
            .current_track
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))? = None;
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::SetVolume(volume))
            .map_err(|e| AppError::Audio(e.to_string()))
    }

    pub fn seek(&self, position: Duration) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Seek(position))
            .map_err(|e| AppError::Audio(e.to_string()))
    }

    pub fn get_state(&self) -> PlaybackState {
        let playing = self.shared.playing.load(Ordering::Relaxed);
        let position = u64_to_f64(self.shared.position.load(Ordering::Relaxed));
        let duration = u64_to_f64(self.shared.duration.load(Ordering::Relaxed));
        let volume = u64_to_f64(self.shared.volume.load(Ordering::Relaxed)) as f32;
        let current_track = self
            .shared
            .current_track
            .lock()
            .ok()
            .and_then(|t| t.clone());

        PlaybackState {
            playing,
            position,
            duration,
            volume,
            current_track,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufReader;

    struct SilentWav(std::path::PathBuf);

    impl SilentWav {
        fn new() -> Self {
            use std::io::Write;
            let path = std::env::temp_dir().join(format!(
                "flowplayer-recovery-{}-{:?}.wav",
                std::process::id(),
                std::thread::current().id(),
            ));
            let mut file = std::fs::File::create(&path).expect("create recovery fixture");
            let data_size = 48_000_u32 * 2 * 2 * 30;
            file.write_all(b"RIFF").expect("RIFF");
            file.write_all(&(36 + data_size).to_le_bytes())
                .expect("RIFF size");
            file.write_all(b"WAVEfmt ").expect("WAVE");
            file.write_all(&16_u32.to_le_bytes()).expect("format size");
            file.write_all(&1_u16.to_le_bytes()).expect("PCM");
            file.write_all(&2_u16.to_le_bytes()).expect("stereo");
            file.write_all(&48_000_u32.to_le_bytes())
                .expect("sample rate");
            file.write_all(&192_000_u32.to_le_bytes())
                .expect("byte rate");
            file.write_all(&4_u16.to_le_bytes()).expect("block size");
            file.write_all(&16_u16.to_le_bytes()).expect("bits");
            file.write_all(b"data").expect("data");
            file.write_all(&data_size.to_le_bytes()).expect("data size");
            file.write_all(&vec![0; data_size as usize])
                .expect("silent PCM");
            Self(path)
        }
    }

    impl Drop for SilentWav {
        fn drop(&mut self) {
            let deadline = Instant::now() + Duration::from_secs(3);
            loop {
                match std::fs::remove_file(&self.0) {
                    Ok(()) => return,
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::PermissionDenied
                            && Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(25))
                    }
                    Err(error) => {
                        eprintln!(
                            "Cannot remove recovery fixture {}: {error}",
                            self.0.display()
                        );
                        return;
                    }
                }
            }
        }
    }

    fn wait_for_state(
        player: &AudioPlayer,
        predicate: impl Fn(&PlaybackState) -> bool,
    ) -> PlaybackState {
        let deadline = Instant::now() + Duration::from_secs(8);
        loop {
            let state = player.get_state();
            if predicate(&state) {
                return state;
            }
            assert!(
                Instant::now() < deadline,
                "audio state timed out: {state:?}"
            );
            std::thread::sleep(Duration::from_millis(25));
        }
    }

    #[test]
    #[ignore = "requires an active native audio output; run explicitly"]
    fn native_output_loss_recovers_playing_and_paused_tracks() {
        let fixture = SilentWav::new();
        let path = fixture.0.to_str().expect("fixture path");
        let (player, events) =
            AudioPlayer::new(Arc::new(Mutex::new(VecDeque::new()))).expect("native audio output");
        player.set_volume(0.23).expect("set volume");
        player.play_file(path).expect("play silent fixture");
        let before = wait_for_state(&player, |s| s.playing && s.position > 0.3);
        for paused in [false, true] {
            if paused {
                player.pause().expect("pause before output loss");
                wait_for_state(&player, |s| !s.playing);
            }
            player
                .tx
                .send(AudioCommand::SimulateOutputLoss)
                .expect("simulate loss");
            assert!(matches!(
                events.recv_timeout(Duration::from_secs(8)).expect("output error event"),
                AudioEvent::Error(message) if message.contains("Simulated output device loss")
            ));
            assert!(matches!(
                events
                    .recv_timeout(Duration::from_secs(8))
                    .expect("output recovered event"),
                AudioEvent::OutputRecovered
            ));
            let after = wait_for_state(&player, |s| s.playing != paused);
            assert_eq!(after.current_track.as_deref(), Some(path));
            assert!((after.volume - 0.23).abs() < 0.001);
            assert!(after.position >= before.position, "position must not reset");
            if paused {
                let position = after.position;
                std::thread::sleep(Duration::from_millis(300));
                assert_eq!(
                    player.get_state().position,
                    position,
                    "paused clock must remain frozen"
                );
            }
        }
        player.stop().expect("stop native fixture");
        wait_for_state(&player, |s| !s.playing && s.current_track.is_none());
        drop(player);
    }

    fn idle_output() -> (Sink, SharedOutput) {
        let (sink, queue) = Sink::new_idle();
        (
            sink,
            SharedOutput(Arc::new(Mutex::new(
                rodio::source::UniformSourceIterator::new(queue, 2, 48_000),
            ))),
        )
    }

    #[test]
    fn output_reconnection_keeps_decoder_progress_and_volume() {
        let (sink, output) = idle_output();
        sink.set_volume(0.5);
        sink.append(rodio::buffer::SamplesBuffer::new(
            2,
            48_000,
            (0..20_000).map(|i| i as f32 / 20_000.0).collect::<Vec<_>>(),
        ));
        let mut connection =
            rodio::source::UniformSourceIterator::<_, f32>::new(output.clone(), 2, 48_000);
        let before = connection
            .by_ref()
            .take(2_000)
            .last()
            .expect("sample before disconnect");
        drop(connection);
        let mut reconnected =
            rodio::source::UniformSourceIterator::<_, f32>::new(output, 1, 44_100);
        let after = reconnected.next().expect("sample after reconnect");
        assert!(
            after >= before,
            "decoder must not restart: {after} < {before}"
        );
        assert!(after < before + 0.01, "reconnect must not skip the track");
        assert_eq!(sink.volume(), 0.5);
        assert!(!sink.empty());
    }

    #[test]
    fn new_track_can_replace_queue_without_a_connected_output() {
        let (old_sink, output) = idle_output();
        old_sink.append(rodio::buffer::SamplesBuffer::new(
            2,
            48_000,
            vec![0.1_f32; 2_000],
        ));
        old_sink.stop();
        let sink = replace_sink(&output, 0.4);
        sink.append(rodio::buffer::SamplesBuffer::new(
            2,
            48_000,
            vec![0.8_f32; 2_000],
        ));
        let mut connection = output;
        assert!((connection.next().expect("new track sample") - 0.32).abs() < 0.0001);
        assert_eq!(sink.volume(), 0.4);
    }

    #[test]
    fn disconnected_playback_resumes_only_if_still_requested() {
        let mut intent = PlaybackIntent {
            requested: true,
            connected: true,
        };
        assert!(intent.playing());
        intent.connected = false;
        assert!(!intent.playing());
        intent.connected = true;
        assert!(intent.playing());
        intent.connected = false;
        intent.requested = false;
        intent.connected = true;
        assert!(
            !intent.playing(),
            "pause or stop during disconnect must survive recovery"
        );
    }

    #[test]
    fn replacing_paused_track_starts_new_source_unpaused() {
        let (old_sink, output) = idle_output();
        old_sink.pause();
        old_sink.stop();
        let sink = replace_sink(&output, 0.8);
        sink.append(rodio::buffer::SamplesBuffer::new(
            2,
            48_000,
            vec![0.5_f32; 2_000],
        ));
        sink.play();
        assert!(!sink.is_paused());
        assert!((output.clone().next().expect("playing source sample") - 0.4).abs() < 0.0001);
    }

    #[test]
    fn clock_does_not_advance_while_paused() {
        let t0 = Instant::now();
        let mut clock = PlaybackClock {
            started: t0,
            paused_at: None,
        };
        clock.pause(t0 + Duration::from_secs(10));
        assert_eq!(clock.position(t0 + Duration::from_secs(10)), 10.0);
        assert_eq!(clock.position(t0 + Duration::from_secs(500)), 10.0);
    }

    #[test]
    fn clock_resumes_without_counting_paused_time() {
        let t0 = Instant::now();
        let mut clock = PlaybackClock {
            started: t0,
            paused_at: None,
        };
        clock.pause(t0 + Duration::from_secs(10));
        clock.resume(t0 + Duration::from_secs(40));
        assert_eq!(clock.position(t0 + Duration::from_secs(45)), 15.0);
    }

    #[test]
    fn clock_seek_while_paused_stays_at_target() {
        let t0 = Instant::now();
        let mut clock = PlaybackClock {
            started: t0,
            paused_at: None,
        };
        clock.pause(t0 + Duration::from_secs(5));
        clock.seek(60.0, t0 + Duration::from_secs(20));
        assert_eq!(clock.position(t0 + Duration::from_secs(90)), 60.0);
        clock.resume(t0 + Duration::from_secs(100));
        assert_eq!(clock.position(t0 + Duration::from_secs(102)), 62.0);
    }

    #[test]
    fn clock_seek_while_playing_continues_from_target() {
        let t0 = Instant::now();
        let mut clock = PlaybackClock {
            started: t0,
            paused_at: None,
        };
        clock.seek(30.0, t0 + Duration::from_secs(8));
        assert_eq!(clock.position(t0 + Duration::from_secs(10)), 32.0);
    }
    #[test]
    fn decode_sample_mp3() {
        let path = r"C:\Users\Admin\Music\04. I'm So Sorry.mp3";
        if !std::path::Path::new(path).exists() {
            eprintln!("SKIP: {path} not found");
            return;
        }
        let file = std::fs::File::open(path).expect("open mp3");
        let decoder = Decoder::new(BufReader::new(file)).expect("decode mp3");
        // rodio's total_duration() returns 0 for some MP3s — that's a known limitation.
        // Duration is read from lofty during scan_folder instead.
        // We just verify the file decodes without error.
        let _ = decoder.total_duration();
        eprintln!("OK: MP3 decoded successfully");
    }
}
