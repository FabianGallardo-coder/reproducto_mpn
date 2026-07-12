#![allow(dead_code)]

use sled::Db;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedTrack {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
}

pub struct MetadataCache {
    db: Db,
}

impl MetadataCache {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        let db = sled::open(path).map_err(|e| AppError::Metadata(e.to_string()))?;
        Ok(Self { db })
    }

    pub fn get(&self, key: &str) -> Result<Option<CachedTrack>, AppError> {
        match self.db.get(key).map_err(|e| AppError::Metadata(e.to_string()))? {
            Some(data) => {
                let track: CachedTrack = serde_json::from_slice(&data)?;
                Ok(Some(track))
            }
            None => Ok(None),
        }
    }

    pub fn put(&self, track: &CachedTrack) -> Result<(), AppError> {
        let data = serde_json::to_vec(track)?;
        self.db
            .insert(track.path.as_bytes(), data)
            .map_err(|e| AppError::Metadata(e.to_string()))?;
        Ok(())
    }

    pub fn clear(&self) -> Result<(), AppError> {
        self.db.clear().map_err(|e| AppError::Metadata(e.to_string()))?;
        Ok(())
    }
}
