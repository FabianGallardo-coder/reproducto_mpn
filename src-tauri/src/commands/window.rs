use tauri::Manager;

#[tauri::command]
pub async fn set_window_decorations(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("window not found")?;
    window.set_decorations(enabled).map_err(|e| e.to_string())
}
