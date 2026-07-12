#![allow(dead_code)]

use crate::error::AppError;
use crate::metadata::cache::CachedTrack;

pub async fn resolve_metadata(url: &str) -> Result<CachedTrack, AppError> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Metadata(format!("Request failed: {e}")))?;

    let _text = response
        .text()
        .await
        .map_err(|e| AppError::Metadata(format!("Read response failed: {e}")))?;

    // ponytail: stub — implement real YouTube metadata extraction when needed
    Ok(CachedTrack {
        path: url.to_string(),
        title: "YouTube Track".into(),
        artist: "Unknown Artist".into(),
        album: "YouTube".into(),
        duration: 0.0,
    })
}
