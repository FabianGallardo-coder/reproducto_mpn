use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Audio error: {0}")]
    Audio(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Metadata error: {0}")]
    Metadata(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Walkdir error: {0}")]
    Walkdir(#[from] walkdir::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_messages() {
        assert_eq!(
            AppError::Audio("no device".into()).to_string(),
            "Audio error: no device"
        );
        assert_eq!(
            AppError::Config("bad value".into()).to_string(),
            "Config error: bad value"
        );
        assert_eq!(
            AppError::Metadata("no tags".into()).to_string(),
            "Metadata error: no tags"
        );
    }

    #[test]
    fn error_serializes_to_string() {
        let err = AppError::Audio("test".into());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"Audio error: test\"");
    }
}
