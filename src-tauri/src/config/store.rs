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

    pub fn get_mut(&mut self) -> &mut AppConfig {
        &mut self.config
    }

    pub fn set(&mut self, config: AppConfig) -> Result<(), AppError> {
        self.config = config;
        let data = serde_json::to_string_pretty(&self.config)?;
        std::fs::write(&self.path, data)?;
        Ok(())
    }
}
