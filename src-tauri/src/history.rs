use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const MAX_ENTRIES: usize = 2000;
const DUPLICATE_WINDOW_MS: i64 = 5_000;
const MAX_FIELD_LEN: usize = 500;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayEntry {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub source: String,
    /// Unix epoch in milliseconds.
    pub played_at: i64,
}

impl PlayEntry {
    fn validate(&self) -> Result<(), AppError> {
        if self.path.is_empty() {
            return Err(AppError::Config("history entry needs a path".into()));
        }
        if !matches!(self.source.as_str(), "local" | "youtube" | "radio") {
            return Err(AppError::Config(format!("unknown history source: {}", self.source)));
        }
        if !self.duration.is_finite() || self.duration < 0.0 {
            return Err(AppError::Config("history duration must be a positive number".into()));
        }
        let too_long = [&self.path, &self.title, &self.artist, &self.album]
            .iter()
            .any(|field| field.chars().count() > MAX_FIELD_LEN);
        if too_long {
            return Err(AppError::Config("history entry field too long".into()));
        }
        Ok(())
    }
}

/// Play history kept in its own file so `set_config` round-trips can never wipe it.
pub struct HistoryStore {
    path: PathBuf,
    /// Oldest first.
    entries: Vec<PlayEntry>,
}

impl HistoryStore {
    /// A missing or corrupt file yields an empty history instead of an error.
    pub fn load(path: &Path) -> Self {
        let entries = match std::fs::read_to_string(path) {
            Ok(data) => serde_json::from_str::<Vec<PlayEntry>>(&data).unwrap_or_else(|e| {
                log::warn!("history at {} was unreadable ({e}); starting empty", path.display());
                Vec::new()
            }),
            Err(_) => Vec::new(),
        };
        let mut store = Self { path: path.to_path_buf(), entries };
        store.trim();
        store
    }

    fn trim(&mut self) {
        if self.entries.len() > MAX_ENTRIES {
            let excess = self.entries.len() - MAX_ENTRIES;
            self.entries.drain(..excess);
        }
    }

    fn persist(&self) -> Result<(), AppError> {
        let data = serde_json::to_string(&self.entries)?;
        let tmp = self.path.with_extension("tmp");
        std::fs::write(&tmp, data)?;
        std::fs::rename(&tmp, &self.path)?;
        Ok(())
    }

    /// Returns `false` when the entry was ignored as an accidental duplicate.
    pub fn record(&mut self, entry: PlayEntry) -> Result<bool, AppError> {
        entry.validate()?;
        if let Some(last) = self.entries.last() {
            let close = (entry.played_at - last.played_at).abs() < DUPLICATE_WINDOW_MS;
            if close && last.path == entry.path {
                return Ok(false);
            }
        }
        self.entries.push(entry);
        self.trim();
        self.persist()?;
        Ok(true)
    }

    /// Newest first.
    pub fn list(&self) -> Vec<PlayEntry> {
        self.entries.iter().rev().cloned().collect()
    }

    pub fn clear(&mut self) -> Result<(), AppError> {
        self.entries.clear();
        self.persist()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("flowplayer_history_{name}.json"))
    }

    fn entry(path: &str, played_at: i64) -> PlayEntry {
        PlayEntry {
            path: path.into(),
            title: "Title".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            duration: 120.0,
            source: "local".into(),
            played_at,
        }
    }

    #[test]
    fn missing_file_starts_empty() {
        let path = temp_path("missing");
        let _ = std::fs::remove_file(&path);
        assert!(HistoryStore::load(&path).list().is_empty());
    }

    #[test]
    fn corrupt_file_recovers_to_empty_history() -> Result<(), AppError> {
        let path = temp_path("corrupt");
        std::fs::write(&path, "{not json")?;
        let mut store = HistoryStore::load(&path);
        assert!(store.list().is_empty());
        assert!(store.record(entry("a.mp3", 10_000))?);
        assert_eq!(HistoryStore::load(&path).list().len(), 1);
        let _ = std::fs::remove_file(&path);
        Ok(())
    }

    #[test]
    fn records_newest_first_and_persists() -> Result<(), AppError> {
        let path = temp_path("persist");
        let _ = std::fs::remove_file(&path);
        let mut store = HistoryStore::load(&path);
        store.record(entry("a.mp3", 10_000))?;
        store.record(entry("b.mp3", 20_000))?;
        let reloaded = HistoryStore::load(&path).list();
        assert_eq!(reloaded.iter().map(|e| e.path.as_str()).collect::<Vec<_>>(), ["b.mp3", "a.mp3"]);
        let _ = std::fs::remove_file(&path);
        Ok(())
    }

    #[test]
    fn ignores_same_track_within_five_seconds() -> Result<(), AppError> {
        let path = temp_path("dupes");
        let _ = std::fs::remove_file(&path);
        let mut store = HistoryStore::load(&path);
        assert!(store.record(entry("a.mp3", 10_000))?);
        assert!(!store.record(entry("a.mp3", 12_000))?);
        assert!(store.record(entry("a.mp3", 16_000))?);
        assert!(store.record(entry("b.mp3", 16_500))?);
        assert_eq!(store.list().len(), 3);
        let _ = std::fs::remove_file(&path);
        Ok(())
    }

    #[test]
    fn caps_history_dropping_the_oldest() -> Result<(), AppError> {
        let path = temp_path("cap");
        let _ = std::fs::remove_file(&path);
        let mut store = HistoryStore::load(&path);
        store.entries = (0..(MAX_ENTRIES as i64 + 4))
            .map(|i| entry(&format!("track-{i}.mp3"), i * 10_000))
            .collect();
        store.record(entry("newest.mp3", i64::MAX / 2))?;
        let list = store.list();
        assert_eq!(list.len(), MAX_ENTRIES);
        assert_eq!(list[0].path, "newest.mp3");
        assert_eq!(list[list.len() - 1].path, "track-5.mp3");
        let _ = std::fs::remove_file(&path);
        Ok(())
    }

    #[test]
    fn rejects_invalid_entries() {
        let path = temp_path("invalid");
        let _ = std::fs::remove_file(&path);
        let mut store = HistoryStore::load(&path);
        assert!(store.record(entry("", 1)).is_err());
        let mut bad_source = entry("a.mp3", 1);
        bad_source.source = "tape".into();
        assert!(store.record(bad_source).is_err());
        let mut bad_duration = entry("a.mp3", 1);
        bad_duration.duration = f64::NAN;
        assert!(store.record(bad_duration).is_err());
        assert!(store.list().is_empty());
    }

    #[test]
    fn clear_empties_and_persists() -> Result<(), AppError> {
        let path = temp_path("clear");
        let _ = std::fs::remove_file(&path);
        let mut store = HistoryStore::load(&path);
        store.record(entry("a.mp3", 10_000))?;
        store.clear()?;
        assert!(store.list().is_empty());
        assert!(HistoryStore::load(&path).list().is_empty());
        let _ = std::fs::remove_file(&path);
        Ok(())
    }
}
