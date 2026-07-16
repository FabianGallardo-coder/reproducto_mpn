use std::path::PathBuf;
use crate::error::AppError;

fn validate_path(path: &str, expect_file: bool, base_dir: Option<&PathBuf>) -> Result<PathBuf, AppError> {
    let p = PathBuf::from(path);
    let canonical = p.canonicalize().map_err(AppError::Io)?;

    if let Some(base) = base_dir {
        let base_canonical = base.canonicalize().map_err(AppError::Io)?;
        if !canonical.starts_with(&base_canonical) {
            return Err(AppError::Io(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "Path is outside allowed directory",
            )));
        }
    }

    if expect_file && !canonical.is_file() {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Path is not a file",
        )));
    }
    if !expect_file && !canonical.is_dir() {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Path is not a directory",
        )));
    }
    Ok(canonical)
}

pub fn validate_file_path(path: &str, base_dir: Option<&PathBuf>) -> Result<PathBuf, AppError> {
    validate_path(path, true, base_dir)
}

pub fn validate_dir_path(path: &str, base_dir: Option<&PathBuf>) -> Result<PathBuf, AppError> {
    validate_path(path, false, base_dir)
}