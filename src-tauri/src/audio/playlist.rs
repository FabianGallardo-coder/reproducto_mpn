use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

use crate::audio::track_info::TrackInfo;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum RepeatMode {
    Off,
    #[default]
    All,
    One,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlaylistManager {
    tracks: Vec<TrackInfo>,
    index: usize,
    shuffle: bool,
    repeat: RepeatMode,
    shuffle_order: Vec<usize>,
    shuffle_pos: usize,
}

impl PlaylistManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_tracks(&mut self, tracks: Vec<TrackInfo>, start_index: usize) {
        self.tracks = tracks;
        self.index = start_index.min(self.tracks.len().saturating_sub(1));
        if self.shuffle {
            self.build_shuffle_order();
        }
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

    pub fn is_shuffle(&self) -> bool {
        self.shuffle
    }

    pub fn repeat_mode(&self) -> RepeatMode {
        self.repeat
    }

    pub fn set_shuffle(&mut self, on: bool) {
        self.shuffle = on;
        if on {
            self.build_shuffle_order();
        }
    }

    pub fn set_repeat(&mut self, mode: RepeatMode) {
        self.repeat = mode;
    }

    pub fn next(&mut self) -> Option<&TrackInfo> {
        if self.tracks.is_empty() {
            return None;
        }

        if self.repeat == RepeatMode::One {
            return self.tracks.get(self.index);
        }

        if self.shuffle {
            self.shuffle_pos += 1;
            if self.shuffle_pos >= self.shuffle_order.len() {
                if self.repeat == RepeatMode::All {
                    self.build_shuffle_order();
                    self.shuffle_pos = 0;
                } else {
                    return None;
                }
            }
            self.index = self.shuffle_order[self.shuffle_pos];
        } else {
            let next_idx = self.index + 1;
            if next_idx >= self.tracks.len() {
                if self.repeat == RepeatMode::All {
                    self.index = 0;
                } else {
                    return None;
                }
            } else {
                self.index = next_idx;
            }
        }

        self.tracks.get(self.index)
    }

    pub fn previous(&mut self) -> Option<&TrackInfo> {
        if self.tracks.is_empty() {
            return None;
        }

        if self.shuffle {
            if self.shuffle_pos > 0 {
                self.shuffle_pos -= 1;
                self.index = self.shuffle_order[self.shuffle_pos];
            }
        } else if self.index == 0 {
            self.index = self.tracks.len() - 1;
        } else {
            self.index -= 1;
        }

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

    fn build_shuffle_order(&mut self) {
        let mut rng = rand::rng();
        self.shuffle_order = (0..self.tracks.len()).collect();
        self.shuffle_order.shuffle(&mut rng);
        // Ensure current track is first
        if let Some(pos) = self.shuffle_order.iter().position(|&i| i == self.index) {
            self.shuffle_order.swap(0, pos);
        }
        self.shuffle_pos = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(name: &str) -> TrackInfo {
        TrackInfo {
            path: format!("/{name}.mp3"),
            title: name.into(),
            artist: "A".into(),
            album: "B".into(),
            duration: 180.0,
        }
    }

    fn playlist3() -> PlaylistManager {
        let mut pm = PlaylistManager::new();
        pm.set_tracks(vec![track("a"), track("b"), track("c")], 0);
        pm
    }

    #[test]
    fn next_wraps_with_repeat_all() {
        let mut pm = playlist3();
        pm.set_repeat(RepeatMode::All);
        pm.next(); // b
        pm.next(); // c
        let t = pm.next(); // wraps to a
        assert_eq!(t.unwrap().title, "a");
    }

    #[test]
    fn next_stops_with_repeat_off() {
        let mut pm = playlist3();
        pm.set_repeat(RepeatMode::Off);
        pm.next();
        pm.next();
        assert!(pm.next().is_none());
    }

    #[test]
    fn repeat_one_returns_same() {
        let mut pm = playlist3();
        pm.set_repeat(RepeatMode::One);
        let t1 = pm.next();
        assert_eq!(t1.unwrap().title, "a");
    }

    #[test]
    fn previous_wraps() {
        let mut pm = playlist3();
        let t = pm.previous();
        assert_eq!(t.unwrap().title, "c");
    }

    #[test]
    fn play_index() {
        let mut pm = playlist3();
        let t = pm.play_index(2);
        assert_eq!(t.unwrap().title, "c");
    }

    #[test]
    fn play_index_out_of_bounds() {
        let mut pm = playlist3();
        assert!(pm.play_index(10).is_none());
    }

    #[test]
    fn shuffle_covers_all_tracks() {
        let mut pm = PlaylistManager::new();
        let tracks: Vec<TrackInfo> = (0..20).map(|i| track(&format!("t{i}"))).collect();
        pm.set_tracks(tracks, 0);
        pm.set_shuffle(true);

        let mut visited = vec![false; 20];
        // Initial track is at shuffle_order[0]
        visited[0] = true;
        // 19 next() calls visit positions 1-19
        for _ in 0..19 {
            if let Some(t) = pm.next() {
                let idx: usize = t.title[1..].parse().unwrap();
                visited[idx] = true;
            }
        }
        assert!(visited.iter().all(|v| *v));
    }
}
