use std::io::BufReader;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::time::Duration;

use rodio::{Decoder, OutputStream, Sink};
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
    state: std::sync::Mutex<PlaybackState>,
}

impl AudioPlayer {
    pub fn new() -> Result<(Self, mpsc::Receiver<AudioEvent>), AppError> {
        let (cmd_tx, cmd_rx) = mpsc::channel::<AudioCommand>();
        let (event_tx, event_rx) = mpsc::channel::<AudioEvent>();
        let (init_tx, init_rx) = mpsc::channel::<Result<(), String>>();

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

                            sink.stop();
                            sink.append(source);

                            let gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
                            let sink_clone = Arc::clone(&sink);
                            let evt = event_tx.clone();
                            let gen = Arc::new(gen);

                            let _ = std::thread::Builder::new()
                                .name("track-end-poll".into())
                                .spawn(move || {
                                    loop {
                                        std::thread::sleep(Duration::from_millis(200));
                                        if sink_clone.empty() {
                                            let _ = evt.send(AudioEvent::TrackEnded);
                                            break;
                                        }
                                        let _ = gen; // keep alive
                                    }
                                })
                                .map(|_| ())
                                .map_err(|e| AppError::Audio(format!("Spawn poll: {e}")));
                        }
                        AudioCommand::Pause => sink.pause(),
                        AudioCommand::Resume => sink.play(),
                        AudioCommand::Stop => {
                            sink.stop();
                            generation.fetch_add(1, Ordering::SeqCst);
                        }
                        AudioCommand::SetVolume(v) => sink.set_volume(v),
                        AudioCommand::Seek(pos) => {
                            let _ = sink.try_seek(pos);
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
            state: std::sync::Mutex::new(PlaybackState {
                playing: false,
                position: 0.0,
                duration: 0.0,
                volume: 0.8,
                current_track: None,
            }),
        };

        Ok((player, event_rx))
    }

    pub fn play_file(&self, path: &str) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::PlayFile(path.to_string()))
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if let Ok(mut state) = self.state.lock() {
            state.playing = true;
            state.current_track = Some(path.to_string());
        }
        Ok(())
    }

    pub fn pause(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Pause)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if let Ok(mut state) = self.state.lock() {
            state.playing = false;
        }
        Ok(())
    }

    pub fn resume(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Resume)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if let Ok(mut state) = self.state.lock() {
            state.playing = true;
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Stop)
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if let Ok(mut state) = self.state.lock() {
            state.playing = false;
            state.current_track = None;
        }
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::SetVolume(volume))
            .map_err(|e| AppError::Audio(e.to_string()))?;
        if let Ok(mut state) = self.state.lock() {
            state.volume = volume;
        }
        Ok(())
    }

    pub fn seek(&self, position: Duration) -> Result<(), AppError> {
        self.tx
            .send(AudioCommand::Seek(position))
            .map_err(|e| AppError::Audio(e.to_string()))
    }

    pub fn get_state(&self) -> PlaybackState {
        self.state
            .lock()
            .map(|s| s.clone())
            .unwrap_or(PlaybackState {
                playing: false,
                position: 0.0,
                duration: 0.0,
                volume: 0.8,
                current_track: None,
            })
    }
}
