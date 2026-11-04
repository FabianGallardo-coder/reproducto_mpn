use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

const BUFFER_SIZE: usize = 64;
const NUM_BINS: usize = 64;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioData {
    pub bins: Vec<f32>,
}

pub struct AudioAnalyzer {
    buffer: Arc<Mutex<VecDeque<f32>>>,
}

impl AudioAnalyzer {
    pub fn new() -> Self {
        Self {
            buffer: Arc::new(Mutex::new(VecDeque::with_capacity(BUFFER_SIZE))),
        }
    }

    pub fn get_data(&self) -> AudioData {
        let buf = match self.buffer.lock() {
            Ok(b) => b,
            Err(_) => {
                return AudioData {
                    bins: vec![0.0; NUM_BINS],
                }
            }
        };
        let bins: Vec<f32> = if buf.is_empty() {
            vec![0.0; NUM_BINS]
        } else {
            // Map amplitude history to frequency bins with decay
            (0..NUM_BINS)
                .map(|i| {
                    let pos = (i as f64 / NUM_BINS as f64 * buf.len() as f64) as usize;
                    let val = buf.get(pos).copied().unwrap_or(0.0);
                    // Add slight frequency-dependent weighting (bass heavier)
                    let weight = 1.0 - (i as f32 / NUM_BINS as f32) * 0.4;
                    (val * weight).clamp(0.0, 1.0)
                })
                .collect()
        };
        AudioData { bins }
    }

    pub fn shared(&self) -> Arc<Mutex<VecDeque<f32>>> {
        Arc::clone(&self.buffer)
    }
}
