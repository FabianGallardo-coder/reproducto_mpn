use std::io::BufReader;
use std::sync::mpsc;

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

enum AudioCommand {
    PlayFile(String),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
}

pub struct AudioPlayer {
    tx: mpsc::Sender<AudioCommand>,
    state: std::sync::Mutex<PlaybackState>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, AppError> {
        let (tx, rx) = mpsc::channel::<AudioCommand>();
        let (init_tx, init_rx) = mpsc::channel::<Result<(), String>>();

        std::thread::Builder::new()
            .name("audio-engine".into())
            .spawn(move || {
                let stream = OutputStream::try_default();
                let stream = match stream {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = init_tx.send(Err(format!("Failed to open audio output: {e}")));
                        return;
                    }
                };

                let sink = Sink::try_new(&stream.1);
                let sink = match sink {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = init_tx.send(Err(format!("Failed to create audio sink: {e}")));
                        return;
                    }
                };

                let _ = init_tx.send(Ok(()));

                let mut _stream = stream.0;
                let current_sink = sink;

                while let Ok(cmd) = rx.recv() {
                    match cmd {
                        AudioCommand::PlayFile(path) => {
                            if let Ok(file) = std::fs::File::open(&path) {
                                if let Ok(source) = Decoder::new(BufReader::new(file)) {
                                    current_sink.stop();
                                    current_sink.append(source);
                                }
                            }
                        }
                        AudioCommand::Pause => current_sink.pause(),
                        AudioCommand::Resume => current_sink.play(),
                        AudioCommand::Stop => current_sink.stop(),
                        AudioCommand::SetVolume(v) => current_sink.set_volume(v),
                    }
                }
            })
            .map_err(|e| AppError::Audio(format!("Failed to spawn audio thread: {e}")))?;

        init_rx
            .recv()
            .map_err(|_| AppError::Audio("Audio thread init channel dropped".into()))?
            .map_err(AppError::Audio)?;

        Ok(Self {
            tx,
            state: std::sync::Mutex::new(PlaybackState {
                playing: false,
                position: 0.0,
                duration: 0.0,
                volume: 0.8,
                current_track: None,
            }),
        })
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

    pub fn get_state(&self) -> PlaybackState {
        self.state.lock().map(|s| s.clone()).unwrap_or(PlaybackState {
            playing: false,
            position: 0.0,
            duration: 0.0,
            volume: 0.8,
            current_track: None,
        })
    }
}
