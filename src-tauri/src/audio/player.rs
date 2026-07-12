use std::io::BufReader;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use rodio::{Decoder, OutputStream, Sink, Source};
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
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    Seek(Duration),
}

pub enum AudioEvent {
    TrackEnded,
    Error(String),
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

fn f64_to_u64(v: f64) -> u64 {
    v.to_bits()
}

fn u64_to_f64(v: u64) -> f64 {
    f64::from_bits(v)
}

impl AudioPlayer {
    pub fn new() -> Result<(Self, mpsc::Receiver<AudioEvent>), AppError> {
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

        std::thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || {
                let stream = match OutputStream::try_default() {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = init_tx.send(Err(format!("Audio output: {e}")));
                        return;
                    }
                };

                let sink = match Sink::try_new(&stream.1) {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = init_tx.send(Err(format!("Audio sink: {e}")));
                        return;
                    }
                };

                let sink = Arc::new(sink);
                let _ = init_tx.send(Ok(()));
                let _stream = stream.0;
                let generation = Arc::new(AtomicU64::new(0));

                while let Ok(cmd) = cmd_rx.recv() {
                    match cmd {
                        AudioCommand::PlayFile(path) => {
                            let file = match std::fs::File::open(&path) {
                                Ok(f) => f,
                                Err(e) => {
                                    let _ = event_tx.send(AudioEvent::Error(format!(
                                        "Cannot open: {e}"
                                    )));
                                    continue;
                                }
                            };

                            let source = match Decoder::new(BufReader::new(file)) {
                                Ok(s) => s,
                                Err(e) => {
                                    let _ = event_tx.send(AudioEvent::Error(format!(
                                        "Cannot decode: {e}"
                                    )));
                                    continue;
                                }
                            };

                            let dur = source
                                .total_duration()
                                .unwrap_or_default()
                                .as_secs_f64();
                            shared_clone.duration.store(f64_to_u64(dur), Ordering::Relaxed);
                            shared_clone.position.store(f64_to_u64(0.0), Ordering::Relaxed);

                            sink.stop();
                            sink.append(source);

                            shared_clone
                                .playing
                                .store(true, Ordering::Relaxed);

                            let start = Instant::now();
                            let gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
                            let sink_clone = Arc::clone(&sink);
                            let evt = event_tx.clone();
                            let shared_poll = Arc::clone(&shared_clone);
                            let gen = Arc::new(gen);

                            let _ = std::thread::Builder::new()
                                .name("track-end-poll".into())
                                .spawn(move || {
                                    loop {
                                        std::thread::sleep(Duration::from_millis(250));
                                        let elapsed = start.elapsed().as_secs_f64();
                                        shared_poll
                                            .position
                                            .store(f64_to_u64(elapsed), Ordering::Relaxed);
                                        if sink_clone.empty() {
                                            let _ = evt.send(AudioEvent::TrackEnded);
                                            break;
                                        }
                                        let _ = gen;
                                    }
                                })
                                .map(|_| ())
                                .map_err(|e| AppError::Audio(format!("Spawn poll: {e}")));
                        }
                        AudioCommand::Pause => {
                            sink.pause();
                            shared_clone.playing.store(false, Ordering::Relaxed);
                        }
                        AudioCommand::Resume => {
                            sink.play();
                            shared_clone.playing.store(true, Ordering::Relaxed);
                        }
                        AudioCommand::Stop => {
                            sink.stop();
                            generation.fetch_add(1, Ordering::SeqCst);
                            shared_clone.playing.store(false, Ordering::Relaxed);
                            shared_clone.position.store(f64_to_u64(0.0), Ordering::Relaxed);
                        }
                        AudioCommand::SetVolume(v) => {
                            sink.set_volume(v);
                            shared_clone.volume.store(f64_to_u64(v as f64), Ordering::Relaxed);
                        }
                        AudioCommand::Seek(pos) => {
                            let _ = sink.try_seek(pos);
                            shared_clone
                                .position
                                .store(f64_to_u64(pos.as_secs_f64()), Ordering::Relaxed);
                        }
                    }
                }
            })
            .map_err(|e| AppError::Audio(format!("Spawn audio thread: {e}")))?;

        init_rx
            .recv()
            .map_err(|_| AppError::Audio("Init channel dropped".into()))?
            .map_err(AppError::Audio)?;

        let player = Self {
            tx: cmd_tx,
            shared,
        };

        Ok((player, event_rx))
    }

    pub fn play_file(&self, path: &str) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::PlayFile(path.to_string()))
            .map_err(|e| AppError::Audio(e.to_string()))?;
        *self
            .shared
            .current_track
            .lock()
            .map_err(|e| AppError::Audio(e.to_string()))? = Some(path.to_string());
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
