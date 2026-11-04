use crate::error::AppError;
use std::path::PathBuf;

fn validate_path(
    path: &str,
    expect_file: bool,
    base_dir: Option<&PathBuf>,
) -> Result<PathBuf, AppError> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("fp_test_{name}"))
    }

    #[test]
    fn file_path_valid() {
        let dir = tmp("file_valid");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("test.txt");
        std::fs::write(&file, "hello").unwrap();

        let result = validate_file_path(file.to_str().unwrap(), None);
        assert!(result.is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn file_path_not_a_file() {
        let dir = tmp("not_a_file");
        std::fs::create_dir_all(&dir).unwrap();

        let result = validate_file_path(dir.to_str().unwrap(), None);
        assert!(result.is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn file_path_nonexistent() {
        let result =
            validate_file_path("/tmp/flowplayer_definitely_does_not_exist_12345.txt", None);
        assert!(result.is_err());
    }

    #[test]
    fn dir_path_valid() {
        let dir = tmp("dir_valid");
        std::fs::create_dir_all(&dir).unwrap();

        let result = validate_dir_path(dir.to_str().unwrap(), None);
        assert!(result.is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn dir_path_not_a_dir() {
        let file = tmp("dir_not_a_dir.txt");
        std::fs::write(&file, "x").unwrap();

        let result = validate_dir_path(file.to_str().unwrap(), None);
        assert!(result.is_err());
        std::fs::remove_file(&file).unwrap();
    }

    #[test]
    fn base_dir_rejects_escape() {
        let base = tmp("base_reject");
        let outside = tmp("outside_reject");
        std::fs::create_dir_all(&base).unwrap();
        std::fs::create_dir_all(&outside).unwrap();

        let result = validate_file_path(outside.to_str().unwrap(), Some(&base));
        assert!(result.is_err());
        std::fs::remove_dir_all(&base).unwrap();
        std::fs::remove_dir_all(&outside).unwrap();
    }

    #[test]
    fn base_dir_allows_inside() {
        let base = tmp("base_allow");
        std::fs::create_dir_all(&base).unwrap();
        let file = base.join("inside.txt");
        std::fs::write(&file, "x").unwrap();

        let result = validate_file_path(file.to_str().unwrap(), Some(&base));
        assert!(result.is_ok());
        std::fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn symlink_bypass_rejected() {
        let base = tmp("symlink_base");
        let outside = tmp("symlink_outside");
        std::fs::create_dir_all(&base).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        let secret = outside.join("secret.txt");
        std::fs::write(&secret, "password").unwrap();

        #[cfg(unix)]
        {
            let link = base.join("sneak.txt");
            std::os::unix::fs::symlink(&secret, &link).unwrap();
            let result = validate_file_path(link.to_str().unwrap(), Some(&base));
            assert!(
                result.is_err(),
                "symlink should be rejected by base_dir check"
            );
        }

        std::fs::remove_dir_all(&base).unwrap();
        std::fs::remove_dir_all(&outside).unwrap();
    }

    #[test]
    fn long_path() {
        let dir = tmp("long_path");
        std::fs::create_dir_all(&dir).unwrap();
        let long_name = "a".repeat(200);
        let file = dir.join(format!("{long_name}.txt"));
        std::fs::write(&file, "x").unwrap();

        let result = validate_file_path(file.to_str().unwrap(), None);
        assert!(result.is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn special_chars_in_path() {
        let dir = tmp("special_chars");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("track (1) [copy] - v2.mp3");
        std::fs::write(&file, "x").unwrap();

        let result = validate_file_path(file.to_str().unwrap(), None);
        assert!(result.is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
