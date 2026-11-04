use std::path::Path;

use crate::config::models::AppConfig;
use crate::error::AppError;

pub struct ConfigStore {
    path: std::path::PathBuf,
    config: AppConfig,
}

impl ConfigStore {
    pub fn load(path: &Path) -> Result<Self, AppError> {
        let config = if path.exists() {
            match std::fs::read_to_string(path)
                .ok()
                .and_then(|data| serde_json::from_str::<AppConfig>(&data).ok())
            {
                Some(cfg) => cfg,
                None => {
                    log::warn!(
                        "config at {} was unreadable; restoring defaults",
                        path.display()
                    );
                    let cfg = AppConfig::default();
                    if let Ok(data) = serde_json::to_string_pretty(&cfg) {
                        let _ = std::fs::write(path, data);
                    }
                    cfg
                }
            }
        } else {
            let config = AppConfig::default();
            let data = serde_json::to_string_pretty(&config)?;
            std::fs::write(path, data)?;
            config
        };
        Ok(Self {
            path: path.to_path_buf(),
            config,
        })
    }

    pub fn get(&self) -> &AppConfig {
        &self.config
    }

    fn atomic_write(&self, data: &str) -> Result<(), AppError> {
        let tmp = self.path.with_extension("tmp");
        std::fs::write(&tmp, data)?;
        std::fs::rename(&tmp, &self.path)?;
        Ok(())
    }

    pub fn set(&mut self, config: AppConfig) -> Result<(), AppError> {
        self.config = config;
        let data = serde_json::to_string_pretty(&self.config)?;
        self.atomic_write(&data)
    }

    pub fn update(&mut self, f: impl FnOnce(&mut AppConfig)) -> Result<(), AppError> {
        f(&mut self.config);
        let data = serde_json::to_string_pretty(&self.config)?;
        self.atomic_write(&data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::playlist::RepeatMode;

    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("flowplayer_test_{name}.json"))
    }

    #[test]
    fn load_creates_default_when_missing() {
        let path = temp_path("load_default");
        let _ = std::fs::remove_file(&path);

        let store = ConfigStore::load(&path).unwrap();
        let cfg = store.get();
        assert_eq!(cfg.volume, 0.8);
        assert!(!cfg.shuffle);
        assert_eq!(cfg.repeat, RepeatMode::All);
        assert!(cfg.last_track_index.is_none());

        let _ = std::fs::remove_file(&path);
    }

    fn assert_legacy_repeat_loads(value: &str, expected: RepeatMode, suffix: &str) {
        let path = temp_path(suffix);
        let _ = std::fs::remove_file(&path);
        let persisted = format!(
            r#"{{
                "music_folder": "/music/library",
                "volume": 0.37,
                "shuffle": true,
                "repeat": "{value}",
                "last_track_index": 7,
                "last_position": 12.5,
                "favorites": ["/music/favorite.mp3"],
                "custom_playlists": [{{"name": "Road trip", "tracks": ["/music/track.mp3"]}}]
            }}"#
        );
        std::fs::write(&path, persisted).unwrap();

        let store = ConfigStore::load(&path).unwrap();
        let cfg = store.get();
        assert_eq!(cfg.repeat, expected, "legacy repeat spelling {value}");
        assert_eq!(cfg.music_folder, "/music/library");
        assert!((cfg.volume - 0.37).abs() < f32::EPSILON);
        assert!(cfg.shuffle);
        assert_eq!(cfg.last_track_index, Some(7));
        assert!((cfg.last_position - 12.5).abs() < f64::EPSILON);
        assert_eq!(cfg.favorites, vec!["/music/favorite.mp3"]);
        assert_eq!(cfg.custom_playlists.len(), 1);
        assert_eq!(cfg.custom_playlists[0].name, "Road trip");
        assert_eq!(cfg.custom_playlists[0].tracks, vec!["/music/track.mp3"]);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_preserves_config_when_repeat_uses_legacy_off_spelling() {
        assert_legacy_repeat_loads("Off", RepeatMode::Off, "legacy_repeat_off");
    }

    #[test]
    fn load_preserves_config_when_repeat_uses_legacy_all_spelling() {
        assert_legacy_repeat_loads("All", RepeatMode::All, "legacy_repeat_all");
    }

    #[test]
    fn load_preserves_config_when_repeat_uses_legacy_one_spelling() {
        assert_legacy_repeat_loads("One", RepeatMode::One, "legacy_repeat_one");
    }

    #[test]
    fn set_persists_config() {
        let path = temp_path("set_persist");
        let _ = std::fs::remove_file(&path);

        let mut store = ConfigStore::load(&path).unwrap();
        store
            .update(|c| {
                c.volume = 0.5;
                c.shuffle = true;
            })
            .unwrap();

        let reloaded = ConfigStore::load(&path).unwrap();
        let cfg = reloaded.get();
        assert_eq!(cfg.volume, 0.5);
        assert!(cfg.shuffle);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn roundtrip_json() {
        let path = temp_path("roundtrip");
        let _ = std::fs::remove_file(&path);

        let mut store = ConfigStore::load(&path).unwrap();
        store
            .update(|c| {
                c.last_track_index = Some(42);
                c.last_position = 123.456;
                c.repeat = RepeatMode::One;
            })
            .unwrap();

        let reloaded = ConfigStore::load(&path).unwrap();
        let cfg = reloaded.get();
        assert_eq!(cfg.last_track_index, Some(42));
        assert!((cfg.last_position - 123.456).abs() < f64::EPSILON);
        assert_eq!(cfg.repeat, RepeatMode::One);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_recovers_from_corrupt_json() {
        let path = temp_path("corrupt");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, b"{ this is not valid json :::").unwrap();

        // Should not propagate an error — must restore defaults instead.
        let store = ConfigStore::load(&path).unwrap();
        let cfg = store.get();
        assert_eq!(cfg.volume, 0.8);
        assert!(!cfg.shuffle);
        assert_eq!(cfg.last_track_index, None);

        // Defaults should now be persisted to disk.
        let reloaded = ConfigStore::load(&path).unwrap();
        assert_eq!(reloaded.get().volume, 0.8);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn load_recovers_from_empty_file() {
        let path = temp_path("empty");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&path, b"").unwrap();

        let store = ConfigStore::load(&path).unwrap();
        assert_eq!(store.get().volume, 0.8);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn atomic_write_does_not_leave_tmp_on_success() {
        let path = temp_path("atomic_no_tmp");
        let _ = std::fs::remove_file(&path);
        let tmp = path.with_extension("tmp");
        let _ = std::fs::remove_file(&tmp);

        let mut store = ConfigStore::load(&path).unwrap();
        store.update(|c| c.volume = 0.1).unwrap();

        assert!(
            !tmp.exists(),
            ".tmp file should not remain after successful rename"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn set_overwrites_previous_config() {
        let path = temp_path("set_overwrite");
        let _ = std::fs::remove_file(&path);

        let mut store = ConfigStore::load(&path).unwrap();
        store.update(|c| c.volume = 0.3).unwrap();
        store.update(|c| c.volume = 0.9).unwrap();

        let reloaded = ConfigStore::load(&path).unwrap();
        assert_eq!(reloaded.get().volume, 0.9);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn update_closures_see_previous_state() {
        let path = temp_path("update_chain");
        let _ = std::fs::remove_file(&path);

        let mut store = ConfigStore::load(&path).unwrap();
        store
            .update(|c| {
                c.volume = 0.1;
                c.shuffle = true;
            })
            .unwrap();
        store
            .update(|c| {
                c.volume = c.volume + 0.1;
            })
            .unwrap();

        let cfg = store.get();
        assert!((cfg.volume - 0.2).abs() < f32::EPSILON);
        assert!(cfg.shuffle);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn default_config_values() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.volume, 0.8);
        assert!(!cfg.shuffle);
        assert_eq!(cfg.repeat, crate::audio::playlist::RepeatMode::All);
        assert!(cfg.last_track_index.is_none());
        assert!((cfg.last_position - 0.0).abs() < f64::EPSILON);
        assert!(cfg.favorites.is_empty());
        assert!(cfg.custom_radio_stations.is_empty());
        assert!(cfg.custom_playlists.is_empty());
    }
}
