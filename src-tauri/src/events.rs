#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackEvent {
    pub playing: bool,
    pub position: f64,
    pub track: Option<String>,
}
