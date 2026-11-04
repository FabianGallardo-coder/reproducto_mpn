#[cfg(not(target_os = "android"))]
include!("desktop.rs");

#[cfg(target_os = "android")]
mod mobile;

#[cfg(target_os = "android")]
#[tauri::mobile_entry_point]
pub fn run() {
    mobile::run();
}
