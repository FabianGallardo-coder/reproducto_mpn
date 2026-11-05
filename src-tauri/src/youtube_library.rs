use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, State};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

pub const LIBRARY_EVENT: &str = "youtube-library-changed";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: f64,
    pub available: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub title: String,
    pub items: Vec<Item>,
    pub playlist: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Song {
    #[serde(flatten)]
    pub item: Item,
    pub path: String,
    #[serde(default)]
    pub missing: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Pending,
    Downloading,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Entry {
    pub item: Item,
    pub status: Status,
    pub progress: f64,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub entries: Vec<Entry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Catalog {
    pub version: u32,
    pub songs: Vec<Song>,
    pub playlists: Vec<Collection>,
    pub jobs: Vec<Job>,
}

impl Default for Catalog {
    fn default() -> Self {
        Self {
            version: 1,
            songs: vec![],
            playlists: vec![],
            jobs: vec![],
        }
    }
}

pub struct Library {
    root: PathBuf,
    catalog: Mutex<Catalog>,
    worker: AtomicBool,
    shutdown: AtomicBool,
    child: Mutex<Option<(String, CommandChild)>>,
}

pub struct LibraryState(Result<Arc<Library>, String>);

impl LibraryState {
    pub fn new(root: PathBuf, old_cache: &Path) -> Self {
        let result = Library::load(root, old_cache).map(Arc::new);
        if let Err(error) = &result {
            log::error!("YouTube library unavailable: {error}");
        }
        Self(result)
    }

    pub fn get(&self) -> Result<&Arc<Library>, String> {
        self.0.as_ref().map_err(Clone::clone)
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 200
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn write_catalog(root: &Path, catalog: &Catalog) -> Result<(), String> {
    let path = root.join("library.json");
    let temp = root.join("library.json.tmp");
    let data = serde_json::to_vec_pretty(catalog).map_err(|e| e.to_string())?;
    std::fs::write(&temp, data).map_err(|e| format!("Cannot write YouTube catalog: {e}"))?;
    std::fs::rename(temp, path).map_err(|e| format!("Cannot commit YouTube catalog: {e}"))
}

fn song_exists(song: &Song) -> bool {
    std::fs::metadata(&song.path).is_ok_and(|m| m.is_file() && m.len() > 0)
}

fn retry_entries(job: &mut Job) {
    for entry in &mut job.entries {
        if matches!(entry.status, Status::Failed | Status::Cancelled) && entry.item.available {
            entry.status = Status::Pending;
            entry.progress = 0.0;
            entry.error = None;
        }
    }
}

fn complete_entry(
    catalog: &mut Catalog,
    job_id: &str,
    index: usize,
    result: Result<Song, String>,
) -> Result<(), String> {
    let entry = catalog
        .jobs
        .iter_mut()
        .find(|j| j.id == job_id)
        .and_then(|j| j.entries.get_mut(index))
        .ok_or("Download entry disappeared")?;
    if entry.status != Status::Downloading {
        return Ok(());
    }
    match result {
        Ok(song) => {
            entry.status = Status::Complete;
            entry.progress = 100.0;
            entry.error = None;
            catalog.songs.retain(|s| s.item.id != song.item.id);
            catalog.songs.push(song);
        }
        Err(error) => {
            log::warn!("YouTube item {} failed: {error}", entry.item.id);
            entry.status = Status::Failed;
            entry.error = Some(error);
        }
    }
    Ok(())
}

impl Library {
    pub fn load(root: PathBuf, old_cache: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let manifest = root.join("library.json");
        let mut catalog: Catalog = if manifest.exists() {
            serde_json::from_slice(&std::fs::read(&manifest).map_err(|e| e.to_string())?)
                .map_err(|e| format!("Invalid YouTube catalog; original preserved: {e}"))?
        } else {
            Catalog::default()
        };
        if catalog.version != 1 {
            return Err(format!(
                "Unsupported YouTube catalog version: {}",
                catalog.version
            ));
        }
        for job in &mut catalog.jobs {
            for entry in &mut job.entries {
                if matches!(entry.status, Status::Pending | Status::Downloading) {
                    entry.status = Status::Cancelled;
                    entry.error = Some("Download interrupted. Retry to continue.".into());
                }
            }
        }
        if old_cache.exists() {
            for file in std::fs::read_dir(old_cache).map_err(|e| e.to_string())? {
                let path = file.map_err(|e| e.to_string())?.path();
                let Some(id) = path.file_stem().and_then(|s| s.to_str()) else {
                    continue;
                };
                let Some(ext @ ("m4a" | "mp3")) = path.extension().and_then(|s| s.to_str()) else {
                    continue;
                };
                if !valid_id(id) || catalog.songs.iter().any(|s| s.item.id == id) {
                    continue;
                }
                let destination = root.join(format!("{id}.{ext}"));
                let length = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
                if length == 0 {
                    continue;
                }
                std::fs::copy(&path, &destination)
                    .map_err(|e| format!("Cannot import cached audio: {e}"))?;
                if std::fs::metadata(&destination)
                    .map_err(|e| e.to_string())?
                    .len()
                    != length
                {
                    return Err(
                        "YouTube cache import verification failed; original preserved".into(),
                    );
                }
                let metadata =
                    match crate::metadata::id3::parse_file(&destination.to_string_lossy()) {
                        Ok(metadata) => Some(metadata),
                        Err(error) => {
                            log::warn!("Imported audio metadata {id}: {error}");
                            None
                        }
                    };
                catalog.songs.push(Song {
                    item: Item {
                        id: id.into(),
                        title: metadata
                            .as_ref()
                            .map(|m| m.title.clone())
                            .filter(|s| !s.is_empty())
                            .unwrap_or_else(|| id.into()),
                        artist: metadata
                            .as_ref()
                            .map(|m| m.artist.clone())
                            .unwrap_or_else(|| "YouTube".into()),
                        duration: metadata.map(|m| m.duration).unwrap_or(0.0),
                        available: true,
                    },
                    path: destination.to_string_lossy().into(),
                    missing: false,
                });
            }
        }
        write_catalog(&root, &catalog)?;
        Ok(Self {
            root,
            catalog: Mutex::new(catalog),
            worker: AtomicBool::new(false),
            shutdown: AtomicBool::new(false),
            child: Mutex::new(None),
        })
    }

    fn update<T>(
        &self,
        action: impl FnOnce(&mut Catalog) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut guard = self.catalog.lock().map_err(|e| e.to_string())?;
        let mut next = guard.clone();
        let result = action(&mut next)?;
        write_catalog(&self.root, &next)?;
        *guard = next;
        Ok(result)
    }

    fn notify(&self, app: &tauri::AppHandle) {
        if let Err(error) = app.emit(LIBRARY_EVENT, ()) {
            log::warn!("Cannot notify YouTube library: {error}");
        }
    }

    pub fn stop(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
        match self.child.lock() {
            Ok(mut child) => {
                if let Some((_, child)) = child.take() {
                    if let Err(error) = child.kill() {
                        log::error!("Cannot stop download child: {error}");
                    }
                }
            }
            Err(error) => log::error!("Download child lock: {error}"),
        }
    }
}

async fn run_json(app: &tauri::AppHandle, args: Vec<String>) -> Result<serde_json::Value, String> {
    let output = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(crate::youtube::summarize_stderr(&output.stderr));
    }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Invalid YouTube response: {e}"))
}

fn parse_item(value: &serde_json::Value) -> Result<Item, String> {
    let id = value["id"]
        .as_str()
        .ok_or("YouTube item has no ID")?
        .to_string();
    if !valid_id(&id) {
        return Err("Invalid YouTube item ID".into());
    }
    let title = value["title"]
        .as_str()
        .unwrap_or("Unavailable video")
        .to_string();
    let availability = value["availability"].as_str().unwrap_or("public");
    Ok(Item {
        id,
        title,
        artist: value["uploader"]
            .as_str()
            .or(value["channel"].as_str())
            .unwrap_or("YouTube")
            .into(),
        duration: value["duration"]
            .as_f64()
            .filter(|n| n.is_finite() && *n >= 0.0)
            .unwrap_or(0.0),
        available: !matches!(
            availability,
            "private" | "premium_only" | "subscriber_only" | "needs_auth"
        ) && value["title"]
            .as_str()
            .is_some_and(|s| s != "[Deleted video]" && s != "[Private video]"),
    })
}

#[tauri::command]
pub fn youtube_library(state: State<'_, LibraryState>) -> Result<Catalog, String> {
    let library = state.get()?;
    let mut snapshot = library.catalog.lock().map_err(|e| e.to_string())?.clone();
    for song in &mut snapshot.songs {
        song.missing = !song_exists(song);
    }
    Ok(snapshot)
}

/// A pasted URL must never reach `ytsearch`, which would return unrelated videos.
fn looks_like_link(query: &str) -> bool {
    let text = query.trim_start().to_ascii_lowercase();
    text.starts_with("http://") || text.starts_with("https://")
}

#[tauri::command]
pub async fn youtube_search(
    app: tauri::AppHandle,
    query: String,
    page: usize,
) -> Result<Vec<Item>, String> {
    if query.trim().is_empty() || query.len() > 500 || !(1..=10).contains(&page) {
        return Err("Search requires text and a page between 1 and 10".into());
    }
    if looks_like_link(&query) {
        return Err("Links must be inspected, not searched".into());
    }
    let value = run_json(
        &app,
        vec![
            "--dump-single-json".into(),
            "--flat-playlist".into(),
            "--skip-download".into(),
            "--no-warnings".into(),
            "--playlist-start".into(),
            ((page - 1) * 20 + 1).to_string(),
            "--playlist-end".into(),
            (page * 20).to_string(),
            "--".into(),
            format!("ytsearch{}:{}", page * 20, query.trim()),
        ],
    )
    .await?;
    let entries = value["entries"]
        .as_array()
        .ok_or("Search response has no entries")?;
    entries
        .iter()
        .filter(|v| !v.is_null())
        .map(parse_item)
        .collect()
}

#[tauri::command]
pub async fn youtube_inspect(
    app: tauri::AppHandle,
    url: String,
    playlist: bool,
) -> Result<Collection, String> {
    if !crate::youtube::is_youtube_url(&url) {
        return Err("Use an HTTP(S) YouTube video or playlist link".into());
    }
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.host_str() != Some("youtu.be")
        && !matches!(
            parsed.path().split('/').nth(1),
            Some("watch" | "playlist" | "shorts" | "live" | "embed")
        )
    {
        return Err("Use a video or playlist link, not a channel or profile".into());
    }
    inspect_collection(|start: usize| {
        run_json(
            &app,
            vec![
                "--dump-single-json".into(),
                "--flat-playlist".into(),
                "--skip-download".into(),
                "--no-warnings".into(),
                if playlist {
                    "--yes-playlist"
                } else {
                    "--no-playlist"
                }
                .into(),
                "--playlist-start".into(),
                start.to_string(),
                "--playlist-end".into(),
                (start + 99).to_string(),
                "--".into(),
                url.clone(),
            ],
        )
    })
    .await
}

async fn inspect_collection<F, R>(mut fetch: F) -> Result<Collection, String>
where
    F: FnMut(usize) -> R,
    R: std::future::Future<Output = Result<serde_json::Value, String>>,
{
    let mut collection: Option<Collection> = None;
    let mut start = 1;
    loop {
        let value = fetch(start).await?;
        let id = value["id"]
            .as_str()
            .ok_or("YouTube response has no ID")?
            .to_string();
        if !valid_id(&id) {
            return Err("Invalid YouTube collection ID".into());
        }
        let result = collection.get_or_insert_with(|| Collection {
            id,
            title: value["title"].as_str().unwrap_or("YouTube").into(),
            items: vec![],
            playlist: value["entries"].is_array(),
        });
        if let Some(entries) = value["entries"].as_array() {
            for entry in entries {
                result.items.push(if entry.is_null() {
                    Item {
                        id: format!("unavailable-{}", result.items.len()),
                        title: "Unavailable playlist entry".into(),
                        artist: "YouTube".into(),
                        duration: 0.0,
                        available: false,
                    }
                } else {
                    parse_item(entry)?
                });
            }
            if entries.len() < 100 {
                break;
            }
            start += 100;
        } else {
            result.items.push(parse_item(&value)?);
            break;
        }
    }
    let result = collection.ok_or("YouTube collection unavailable")?;
    if result.items.is_empty() {
        return Err("Playlist is empty or unavailable".into());
    }
    Ok(result)
}

#[tauri::command]
pub fn youtube_enqueue(
    app: tauri::AppHandle,
    state: State<'_, LibraryState>,
    collection: Collection,
) -> Result<String, String> {
    let library = state.get()?;
    if library.shutdown.load(Ordering::SeqCst) {
        return Err("Application is closing".into());
    }
    if !valid_id(&collection.id)
        || collection.items.is_empty()
        || collection
            .items
            .iter()
            .any(|i| !valid_id(&i.id) || !i.duration.is_finite() || i.duration < 0.0)
    {
        return Err("Invalid YouTube collection".into());
    }
    let id = library.update(|catalog| {
        // A collection is one retryable job; shared videos are deduplicated at download time.
        if let Some(job) = catalog.jobs.iter_mut().find(|j| j.id == collection.id) {
            if job
                .entries
                .iter()
                .any(|e| matches!(e.status, Status::Pending | Status::Downloading))
            {
                return Err("This collection is already queued".into());
            }
            job.entries = collection
                .items
                .iter()
                .map(|i| Entry {
                    item: i.clone(),
                    status: Status::Pending,
                    progress: 0.0,
                    error: None,
                })
                .collect();
            job.title = collection.title.clone();
        } else {
            catalog.jobs.push(Job {
                id: collection.id.clone(),
                title: collection.title.clone(),
                entries: collection
                    .items
                    .iter()
                    .map(|i| Entry {
                        item: i.clone(),
                        status: Status::Pending,
                        progress: 0.0,
                        error: None,
                    })
                    .collect(),
            });
        }
        if collection.playlist {
            catalog.playlists.retain(|p| p.id != collection.id);
            catalog.playlists.push(collection.clone());
        }
        Ok(collection.id.clone())
    })?;
    library.notify(&app);
    start_worker(app, Arc::clone(library));
    Ok(id)
}

#[tauri::command]
pub fn youtube_cancel(
    app: tauri::AppHandle,
    state: State<'_, LibraryState>,
    id: String,
) -> Result<(), String> {
    let library = state.get()?;
    library.update(|catalog| {
        let job = catalog
            .jobs
            .iter_mut()
            .find(|j| j.id == id)
            .ok_or("Download job not found")?;
        for entry in &mut job.entries {
            if matches!(entry.status, Status::Pending | Status::Downloading) {
                entry.status = Status::Cancelled;
                entry.error = Some("Cancelled. Retry to continue.".into());
            }
        }
        Ok(())
    })?;
    let mut child = library.child.lock().map_err(|e| e.to_string())?;
    if child.as_ref().is_some_and(|(job_id, _)| *job_id == id) {
        if let Some((_, child)) = child.take() {
            child
                .kill()
                .map_err(|e| format!("Cannot cancel download: {e}"))?;
        }
    }
    library.notify(&app);
    Ok(())
}

#[tauri::command]
pub fn youtube_retry(
    app: tauri::AppHandle,
    state: State<'_, LibraryState>,
    id: String,
) -> Result<(), String> {
    let library = state.get()?;
    library.update(|catalog| {
        let job = catalog
            .jobs
            .iter_mut()
            .find(|j| j.id == id)
            .ok_or("Download job not found")?;
        retry_entries(job);
        Ok(())
    })?;
    library.notify(&app);
    start_worker(app, Arc::clone(library));
    Ok(())
}

fn start_worker(app: tauri::AppHandle, library: Arc<Library>) {
    if library.worker.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        let result = work(&app, &library).await;
        if let Err(error) = &result {
            log::error!("YouTube download worker: {error}");
            let _ = app.emit("youtube-library-error", error);
        }
        library.worker.store(false, Ordering::SeqCst);
        library.notify(&app);
        // Enqueue may race with the worker finishing its last item.
        let pending = match library.catalog.lock() {
            Ok(c) => c
                .jobs
                .iter()
                .any(|j| j.entries.iter().any(|e| e.status == Status::Pending)),
            Err(error) => {
                log::error!("Cannot inspect pending downloads: {error}");
                false
            }
        };
        if result.is_ok() && pending && !library.shutdown.load(Ordering::SeqCst) {
            start_worker(app, library);
        }
    });
}

async fn work(app: &tauri::AppHandle, library: &Library) -> Result<(), String> {
    loop {
        if library.shutdown.load(Ordering::SeqCst) {
            return Ok(());
        }
        let next = {
            let catalog = library.catalog.lock().map_err(|e| e.to_string())?;
            catalog.jobs.iter().find_map(|job| {
                job.entries
                    .iter()
                    .position(|e| e.status == Status::Pending)
                    .map(|index| (job.id.clone(), index, job.entries[index].item.clone()))
            })
        };
        let Some((job_id, index, item)) = next else {
            return Ok(());
        };
        library.update(|catalog| {
            let entry = &mut catalog
                .jobs
                .iter_mut()
                .find(|j| j.id == job_id)
                .ok_or("Job disappeared")?
                .entries[index];
            if entry.status == Status::Pending {
                entry.status = Status::Downloading;
            }
            Ok(())
        })?;
        library.notify(app);
        let result = download_one(app, library, &job_id, index, &item).await;
        library.update(|catalog| complete_entry(catalog, &job_id, index, result))?;
        library.notify(app);
    }
}

async fn download_one(
    app: &tauri::AppHandle,
    library: &Library,
    job_id: &str,
    index: usize,
    item: &Item,
) -> Result<Song, String> {
    if !item.available {
        return Err("Video is private, deleted or unavailable".into());
    }
    {
        let catalog = library.catalog.lock().map_err(|e| e.to_string())?;
        if let Some(song) = catalog
            .songs
            .iter()
            .find(|s| s.item.id == item.id && song_exists(s))
        {
            return Ok(song.clone());
        }
    }
    let mut events = {
        let mut child_guard = library.child.lock().map_err(|e| e.to_string())?;
        let catalog = library.catalog.lock().map_err(|e| e.to_string())?;
        let entry = &catalog
            .jobs
            .iter()
            .find(|j| j.id == job_id)
            .ok_or("Job disappeared")?
            .entries[index];
        if entry.status != Status::Downloading || library.shutdown.load(Ordering::SeqCst) {
            return Err("Cancelled".into());
        }
        let (events, child) = app
            .shell()
            .sidecar("yt-dlp")
            .map_err(|e| e.to_string())?
            .args([
                "-f",
                "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio[ext=mp3]",
                "--no-playlist",
                "--no-warnings",
                "--newline",
                "--progress",
                "--no-simulate",
                "--progress-template",
                "download:FLOW_PROGRESS:%(progress._percent_str)s",
                "--print",
                "after_move:FLOW_FILE:%(filepath)s",
                "-P",
            ])
            .arg(library.root.to_string_lossy().to_string())
            .args([
                "-o",
                "%(id)s.%(ext)s",
                "--",
                &format!("https://www.youtube.com/watch?v={}", item.id),
            ])
            .spawn()
            .map_err(|e| e.to_string())?;
        *child_guard = Some((job_id.into(), child));
        events
    };
    let mut file = None;
    let mut error = String::new();
    let mut success = false;
    while let Some(event) = events.recv().await {
        match event {
            CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                let line = String::from_utf8_lossy(&bytes);
                if let Some(path) = line.trim().strip_prefix("FLOW_FILE:") {
                    file = Some(PathBuf::from(path));
                }
                if let Some(percent) = line
                    .trim()
                    .strip_prefix("FLOW_PROGRESS:")
                    .and_then(|s| s.trim().trim_end_matches('%').trim().parse::<f64>().ok())
                {
                    let mut catalog = library.catalog.lock().map_err(|e| e.to_string())?;
                    if let Some(entry) = catalog
                        .jobs
                        .iter_mut()
                        .find(|j| j.id == job_id)
                        .and_then(|j| j.entries.get_mut(index))
                    {
                        entry.progress = percent.clamp(0.0, 100.0);
                    }
                    drop(catalog);
                    library.notify(app);
                }
                if line.contains("ERROR") {
                    error = line.chars().take(240).collect();
                }
            }
            CommandEvent::Error(message) => error = message,
            CommandEvent::Terminated(status) => {
                success = status.code == Some(0);
                break;
            }
            _ => {}
        }
    }
    library.child.lock().map_err(|e| e.to_string())?.take();
    if !success {
        return Err(if error.is_empty() {
            "Download cancelled or interrupted".into()
        } else {
            error
        });
    }
    let path = file
        .ok_or("Download did not return an audio file")?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if path.parent()
        != Some(
            library
                .root
                .canonicalize()
                .map_err(|e| e.to_string())?
                .as_path(),
        )
        || path.file_stem().and_then(|s| s.to_str()) != Some(&item.id)
        || !matches!(
            path.extension().and_then(|s| s.to_str()),
            Some("m4a" | "mp3")
        )
    {
        return Err("Downloaded file is outside the managed audio library".into());
    }
    let song = Song {
        item: item.clone(),
        path: path.to_string_lossy().into(),
        missing: false,
    };
    if !song_exists(&song) {
        return Err("Downloaded audio file is missing or empty".into());
    }
    Ok(song)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn links_are_never_treated_as_search_text() {
        assert!(looks_like_link("https://www.youtube.com/watch?v=L50II6zJy9U"));
        assert!(looks_like_link("  HTTP://youtu.be/L50II6zJy9U"));
        assert!(!looks_like_link("linkin park https"));
        assert!(!looks_like_link("youtube.com/watch?v=L50II6zJy9U"));
    }
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
            let path = std::env::temp_dir().join(format!(
                "flowplayer-yt-test-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::SeqCst)
            ));
            std::fs::create_dir_all(&path).expect("fixture directory");
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).expect("remove exact fixture directory");
        }
    }
    fn item(id: &str) -> Item {
        Item {
            id: id.into(),
            title: format!("Song {id}"),
            artist: "Author".into(),
            duration: 10.0,
            available: true,
        }
    }
    fn job() -> Job {
        Job {
            id: "PL_demo".into(),
            title: "Playlist".into(),
            entries: vec![
                Entry {
                    item: item("first"),
                    status: Status::Downloading,
                    progress: 10.0,
                    error: None,
                },
                Entry {
                    item: item("second"),
                    status: Status::Pending,
                    progress: 0.0,
                    error: None,
                },
            ],
        }
    }
    fn song(id: &str) -> Song {
        Song {
            item: item(id),
            path: format!("C:\\managed\\{id}.m4a"),
            missing: false,
        }
    }

    #[test]
    fn rejects_path_components_and_empty_ids() {
        for id in ["", "../escape", "..", "a\\b", "a/b", "a:b", "a b"] {
            assert!(!valid_id(id), "{id}");
        }
        assert!(valid_id("PL_ab-CD_123"));
        assert!(!valid_id(&"a".repeat(201)));
        assert!(valid_id(&"a".repeat(200)));
    }
    #[test]
    fn inspection_fetches_every_page_at_and_around_batch_boundaries() {
        for count in [0, 1, 99, 100, 101, 200, 201] {
            let entries: Vec<_> = (0..count)
                .map(|i| json!({"id": format!("video{i}"), "title": format!("Song {i}")}))
                .collect();
            let mut starts = Vec::new();
            let result = tauri::async_runtime::block_on(inspect_collection(|start| {
                starts.push(start);
                std::future::ready(Ok(json!({
                    "id": "PL_test", "title": "Long playlist",
                    "entries": entries.iter().skip(start - 1).take(100).cloned().collect::<Vec<_>>(),
                })))
            }));
            assert_eq!(
                starts,
                (0..=count / 100).map(|i| i * 100 + 1).collect::<Vec<_>>()
            );
            if count == 0 {
                assert_eq!(
                    result.err().as_deref(),
                    Some("Playlist is empty or unavailable")
                );
            } else {
                let result = result.expect("full collection");
                assert!(result.playlist);
                assert_eq!(result.title, "Long playlist");
                assert_eq!(
                    result
                        .items
                        .iter()
                        .map(|item| item.id.clone())
                        .collect::<Vec<_>>(),
                    (0..count).map(|i| format!("video{i}")).collect::<Vec<_>>()
                );
            }
        }
    }

    #[test]
    fn inspection_preserves_null_private_and_repeated_playlist_positions() {
        let result = tauri::async_runtime::block_on(inspect_collection(|_| {
            std::future::ready(Ok(json!({
                "id": "PL_test", "title": "Mixed playlist", "entries": [
                    {"id": "first", "title": "First"}, null,
                    {"id": "private", "title": "[Private video]", "availability": "private"},
                    {"id": "first", "title": "First"}
                ],
            })))
        }))
        .expect("mixed collection");
        assert_eq!(
            result
                .items
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["first", "unavailable-1", "private", "first"]
        );
        assert_eq!(
            result
                .items
                .iter()
                .map(|item| item.available)
                .collect::<Vec<_>>(),
            [true, false, false, true]
        );
    }

    #[test]
    fn inspection_reports_later_page_failure_instead_of_returning_a_partial_playlist() {
        let result = tauri::async_runtime::block_on(inspect_collection(|start| {
            std::future::ready(if start == 1 {
                Ok(
                    json!({"id": "PL_test", "entries": vec![json!({"id": "first", "title": "First"}); 100]}),
                )
            } else {
                Err("Network lost on second page".into())
            })
        }));
        assert_eq!(result.err().as_deref(), Some("Network lost on second page"));
    }
    #[test]
    fn catalog_round_trip_preserves_playlist_order_and_membership() {
        let fixture = Fixture::new();
        let root = fixture.0.join("library");
        let store = Library::load(root.clone(), &fixture.0.join("absent")).expect("new catalog");
        store
            .update(|catalog| {
                catalog.songs = vec![song("first"), song("second")];
                catalog.playlists.push(Collection {
                    id: "PL_demo".into(),
                    title: "My list".into(),
                    items: vec![item("second"), item("first"), item("second")],
                    playlist: true,
                });
                Ok(())
            })
            .expect("persist");
        let reloaded = Library::load(root, &fixture.0.join("absent")).expect("reload");
        let catalog = reloaded.catalog.lock().expect("catalog");
        assert_eq!(catalog.songs.len(), 2);
        assert_eq!(
            catalog.playlists[0]
                .items
                .iter()
                .map(|i| i.id.as_str())
                .collect::<Vec<_>>(),
            ["second", "first", "second"]
        );
    }
    #[test]
    fn corrupt_catalog_is_preserved_and_reported() {
        let fixture = Fixture::new();
        let path = fixture.0.join("library.json");
        std::fs::write(&path, "broken catalog").expect("corrupt fixture");
        assert!(Library::load(fixture.0.clone(), &fixture.0.join("absent"))
            .err()
            .expect("error")
            .contains("original preserved"));
        assert_eq!(
            std::fs::read_to_string(path).expect("original"),
            "broken catalog"
        );
    }
    #[test]
    fn corrupt_catalog_exposes_source_error_without_failing_app_state_creation() {
        let fixture = Fixture::new();
        let path = fixture.0.join("library.json");
        std::fs::write(&path, "broken catalog").expect("corrupt fixture");
        let state = LibraryState::new(fixture.0.clone(), &fixture.0.join("absent"));
        assert!(state
            .get()
            .err()
            .expect("explicit source error")
            .contains("original preserved"));
        assert_eq!(
            std::fs::read_to_string(path).expect("original"),
            "broken catalog"
        );
    }
    #[test]
    fn unsupported_catalog_version_is_not_overwritten() {
        let fixture = Fixture::new();
        let mut catalog = Catalog::default();
        catalog.version = 2;
        write_catalog(&fixture.0, &catalog).expect("write fixture");
        assert!(Library::load(fixture.0.clone(), &fixture.0.join("absent")).is_err());
        let persisted: Catalog =
            serde_json::from_slice(&std::fs::read(fixture.0.join("library.json")).expect("read"))
                .expect("parse");
        assert_eq!(persisted.version, 2);
    }
    #[test]
    fn interrupted_jobs_require_retry_after_restart() {
        let fixture = Fixture::new();
        let mut catalog = Catalog::default();
        catalog.jobs.push(job());
        write_catalog(&fixture.0, &catalog).expect("persist running job");
        let store = Library::load(fixture.0.clone(), &fixture.0.join("absent")).expect("load");
        let catalog = store.catalog.lock().expect("catalog");
        assert!(catalog.jobs[0]
            .entries
            .iter()
            .all(|e| e.status == Status::Cancelled
                && e.error
                    .as_deref()
                    .is_some_and(|s| s.contains("interrupted"))));
    }
    #[test]
    fn migration_copies_complete_cache_without_deleting_or_duplicating() {
        let fixture = Fixture::new();
        let cache = fixture.0.join("cache");
        std::fs::create_dir(&cache).expect("cache");
        std::fs::write(cache.join("video123.m4a"), [1, 2, 3]).expect("audio fixture");
        std::fs::write(cache.join("incomplete.m4a.part"), [9]).expect("part fixture");
        std::fs::write(cache.join("empty.mp3"), []).expect("empty fixture");
        let root = fixture.0.join("library");
        let store = Library::load(root.clone(), &cache).expect("migrate");
        assert_eq!(store.catalog.lock().expect("catalog").songs.len(), 1);
        assert_eq!(
            std::fs::read(root.join("video123.m4a")).expect("copy"),
            [1, 2, 3]
        );
        assert!(cache.join("video123.m4a").exists());
        let again = Library::load(root, &cache).expect("second migration");
        assert_eq!(again.catalog.lock().expect("catalog").songs.len(), 1);
    }
    #[test]
    fn failed_entry_does_not_mark_other_playlist_entries_complete() {
        let mut catalog = Catalog::default();
        catalog.jobs.push(job());
        complete_entry(&mut catalog, "PL_demo", 0, Err("Network lost".into()))
            .expect("finish failure");
        assert_eq!(catalog.jobs[0].entries[0].status, Status::Failed);
        assert_eq!(
            catalog.jobs[0].entries[0].error.as_deref(),
            Some("Network lost")
        );
        assert_eq!(catalog.jobs[0].entries[1].status, Status::Pending);
        assert!(catalog.songs.is_empty());
    }
    #[test]
    fn cancelled_entry_cannot_register_completed_audio() {
        let mut catalog = Catalog::default();
        catalog.jobs.push(job());
        catalog.jobs[0].entries[0].status = Status::Cancelled;
        complete_entry(&mut catalog, "PL_demo", 0, Ok(song("first"))).expect("late result");
        assert_eq!(catalog.jobs[0].entries[0].status, Status::Cancelled);
        assert!(catalog.songs.is_empty());
    }
    #[test]
    fn completion_deduplicates_shared_video_and_retains_playlist_entries() {
        let mut catalog = Catalog::default();
        catalog.jobs.push(job());
        catalog.songs.push(song("first"));
        complete_entry(&mut catalog, "PL_demo", 0, Ok(song("first"))).expect("complete");
        assert_eq!(catalog.songs.len(), 1);
        assert_eq!(catalog.jobs[0].entries[0].status, Status::Complete);
        assert_eq!(catalog.jobs[0].entries[0].progress, 100.0);
        assert_eq!(catalog.jobs[0].entries[1].item.id, "second");
    }
    #[test]
    fn retry_requeues_only_failed_or_cancelled_available_entries() {
        let mut job = job();
        job.entries[0].status = Status::Complete;
        job.entries[1].status = Status::Failed;
        job.entries[1].error = Some("network".into());
        let mut unavailable = job.entries[1].clone();
        unavailable.item.available = false;
        job.entries.push(unavailable);
        retry_entries(&mut job);
        assert_eq!(job.entries[0].status, Status::Complete);
        assert_eq!(job.entries[1].status, Status::Pending);
        assert_eq!(job.entries[1].error, None);
        assert_eq!(job.entries[2].status, Status::Failed);
    }
    #[test]
    fn missing_and_empty_files_are_not_reused_as_downloads() {
        let fixture = Fixture::new();
        let mut audio = song("audio");
        audio.path = fixture.0.join("audio.m4a").to_string_lossy().into();
        assert!(!song_exists(&audio));
        std::fs::write(&audio.path, []).expect("empty");
        assert!(!song_exists(&audio));
        std::fs::write(&audio.path, [1]).expect("file");
        assert!(song_exists(&audio));
    }
    #[test]
    fn private_and_deleted_items_have_explicit_unavailable_state() {
        let private =
            parse_item(&json!({"id":"private", "title":"Private", "availability":"private"}))
                .expect("private item");
        let deleted =
            parse_item(&json!({"id":"deleted", "title":"[Deleted video]"})).expect("deleted item");
        assert!(!private.available);
        assert!(!deleted.available);
        assert!(
            parse_item(&json!({"id":"public", "title":"Public", "duration":4.0}))
                .expect("public")
                .available
        );
        assert!(parse_item(&json!({"id":"../invalid", "title":"Invalid"})).is_err());
    }
}
