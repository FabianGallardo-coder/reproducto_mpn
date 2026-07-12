#![allow(dead_code)]

use crate::error::AppError;

pub fn is_supported(path: &str) -> bool {
    matches!(
        path.rsplit('.').next().map(|e| e.to_lowercase()).as_deref(),
        Some("mp3" | "flac" | "wav" | "ogg" | "aac" | "m4a")
    )
}

pub fn validate_file(path: &str) -> Result<(), AppError> {
    if !is_supported(path) {
        return Err(AppError::Audio(format!(
            "Unsupported format: {path}"
        )));
    }
    if !std::path::Path::new(path).exists() {
        return Err(AppError::Audio(format!("File not found: {path}")));
    }
    Ok(())
}
