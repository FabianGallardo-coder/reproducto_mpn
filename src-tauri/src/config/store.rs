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
            let data = std::fs::read_to_string(path)?;
            serde_json::from_str(&data)?
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

    pub fn set(&mut self, config: AppConfig) -> Result<(), AppError> {
        self.config = config;
        let data = serde_json::to_string_pretty(&self.config)?;
        std::fs::write(&self.path, data)?;
        Ok(())
    }

    pub fn update(&mut self, f: impl FnOnce(&mut AppConfig)) -> Result<(), AppError> {
        f(&mut self.config);
        let data = serde_json::to_string_pretty(&self.config)?;
        std::fs::write(&self.path, data)?;
        Ok(())
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
}
