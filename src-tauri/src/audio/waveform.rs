#![allow(dead_code)]

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveformData {
    pub points: Vec<f32>,
    pub sample_rate: u32,
}

pub fn generate(_path: &str) -> Result<WaveformData, AppError> {
    // ponytail: stub — implement real ffmpeg decode when needed
    Ok(WaveformData {
        points: vec![0.0; 2000],
        sample_rate: 44100,
    })
}
