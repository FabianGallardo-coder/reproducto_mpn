use serde::{Deserialize, Serialize};

use crate::audio::track_info::TrackInfo;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlaylistManager {
    tracks: Vec<TrackInfo>,
    index: usize,
}

impl PlaylistManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_tracks(&mut self, tracks: Vec<TrackInfo>, start_index: usize) {
        self.tracks = tracks;
        self.index = start_index.min(self.tracks.len().saturating_sub(1));
    }

    pub fn tracks(&self) -> &[TrackInfo] {
        &self.tracks
    }

    pub fn current(&self) -> Option<&TrackInfo> {
        self.tracks.get(self.index)
    }

    pub fn current_index(&self) -> usize {
        self.index
    }

    pub fn next(&mut self) -> Option<&TrackInfo> {
        if self.tracks.is_empty() {
            return None;
        }
        self.index = (self.index + 1) % self.tracks.len();
        self.tracks.get(self.index)
    }

    pub fn previous(&mut self) -> Option<&TrackInfo> {
        if self.tracks.is_empty() {
            return None;
        }
        self.index = if self.index == 0 {
            self.tracks.len() - 1
        } else {
            self.index - 1
        };
        self.tracks.get(self.index)
    }

    pub fn play_index(&mut self, index: usize) -> Option<&TrackInfo> {
        if index < self.tracks.len() {
            self.index = index;
            self.tracks.get(self.index)
        } else {
            None
        }
    }
}
