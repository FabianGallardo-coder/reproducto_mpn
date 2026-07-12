#![allow(dead_code)]

use crate::error::AppError;

pub struct RadioStream {
    pub url: &'static str,
    pub name: &'static str,
}

pub const PRESETS: &[RadioStream] = &[
    RadioStream {
        url: "https://somafm.com/groovesalad.pls",
        name: "SomaFM - Groove Salad",
    },
    RadioStream {
        url: "https://somafm.com/dronezone.pls",
        name: "SomaFM - Drone Zone",
    },
];

pub fn get_presets() -> &'static [RadioStream] {
    PRESETS
}

pub fn validate_url(url: &str) -> Result<(), AppError> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(AppError::Audio("Invalid stream URL".into()));
    }
    Ok(())
}
