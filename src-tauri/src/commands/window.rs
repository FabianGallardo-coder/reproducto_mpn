use std::sync::Mutex;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Geometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug)]
struct SavedWindow {
    /// `None` when the window had no usable frame (e.g. it was minimized) at the time.
    geometry: Option<Geometry>,
    maximized: bool,
}

/// Smallest and default desktop window size, in logical pixels.
const MIN_LOGICAL: (f64, f64) = (800.0, 600.0);
const DEFAULT_LOGICAL: (f64, f64) = (1024.0, 768.0);

/// A minimized Windows window reports a tiny frame parked around (-32000, -32000);
/// restoring that would leave the app unusable.
pub fn is_plausible_geometry(g: Geometry) -> bool {
    g.width >= 300 && g.height >= 200 && g.x > -30_000 && g.y > -30_000
}

/// Whether a window with this client size is below the desktop minimum.
pub fn below_minimum(inner: PhysicalSize<u32>, scale: f64) -> bool {
    f64::from(inner.width) < (MIN_LOGICAL.0 * scale).floor()
        || f64::from(inner.height) < (MIN_LOGICAL.1 * scale).floor()
}

/// Desktop window geometry saved while Mini/Zen are active, so leaving them
/// restores what the user had instead of forcing a default size.
#[derive(Default)]
pub struct WindowMemory(Mutex<Option<SavedWindow>>);

/// Shrinks `win` to fit `area` and moves it so it is fully inside.
pub fn fit_to_area(win: Geometry, area: Geometry) -> Geometry {
    let width = win.width.min(area.width);
    let height = win.height.min(area.height);
    let max_x = area.x + (area.width - width) as i32;
    let max_y = area.y + (area.height - height) as i32;
    Geometry {
        x: win.x.clamp(area.x, max_x),
        y: win.y.clamp(area.y, max_y),
        width,
        height,
    }
}

fn outer_geometry(window: &tauri::WebviewWindow) -> Result<Geometry, String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(Geometry { x: pos.x, y: pos.y, width: size.width, height: size.height })
}

/// Usable monitor area (excludes the taskbar).
fn work_area(window: &tauri::WebviewWindow) -> Result<Option<Geometry>, String> {
    let monitor = window.current_monitor().map_err(|e| e.to_string())?;
    Ok(monitor.map(|m| {
        let area = m.work_area();
        Geometry {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        }
    }))
}

/// Places the window so its outer rectangle (frame included) matches `g`.
fn place_outer(window: &tauri::WebviewWindow, g: Geometry) -> Result<(), String> {
    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    let frame_w = outer.width.saturating_sub(inner.width);
    let frame_h = outer.height.saturating_sub(inner.height);
    window
        .set_size(PhysicalSize::new(
            g.width.saturating_sub(frame_w).max(1),
            g.height.saturating_sub(frame_h).max(1),
        ))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(g.x, g.y))
        .map_err(|e| e.to_string())
}

fn remember_desktop_window(
    window: &tauri::WebviewWindow,
    memory: &WindowMemory,
) -> Result<(), String> {
    let mut slot = memory.0.lock().map_err(|e| e.to_string())?;
    if slot.is_some() {
        return Ok(());
    }
    if window.is_minimized().map_err(|e| e.to_string())? {
        window.unminimize().map_err(|e| e.to_string())?;
    }
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    }
    let geometry = outer_geometry(window)?;
    *slot = Some(SavedWindow {
        geometry: is_plausible_geometry(geometry).then_some(geometry),
        maximized,
    });
    Ok(())
}

/// Grows a window that is smaller than the desktop minimum (left over from Mini or a bad saved frame).
fn ensure_usable_size(window: &tauri::WebviewWindow, area: Option<Geometry>) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        return Ok(());
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    if !below_minimum(inner, scale) {
        return Ok(());
    }
    window
        .set_size(tauri::LogicalSize::new(DEFAULT_LOGICAL.0, DEFAULT_LOGICAL.1))
        .map_err(|e| e.to_string())?;
    if let Some(area) = area {
        let current = outer_geometry(window)?;
        let fitted = fit_to_area(current, area);
        if fitted != current {
            place_outer(window, fitted)?;
        }
    }
    Ok(())
}

fn apply_desktop_window(window: &tauri::WebviewWindow, memory: &WindowMemory) -> Result<(), String> {
    if window.is_minimized().map_err(|e| e.to_string())? {
        window.unminimize().map_err(|e| e.to_string())?;
    }
    window.set_always_on_bottom(false).map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_skip_taskbar(false).map_err(|e| e.to_string())?;
    window.set_decorations(true).map_err(|e| e.to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(MIN_LOGICAL.0, MIN_LOGICAL.1)))
        .map_err(|e| e.to_string())?;

    let area = work_area(window)?;
    let saved = memory.0.lock().map_err(|e| e.to_string())?.take();

    match saved {
        Some(saved) => {
            if let Some(geometry) = saved.geometry {
                let target = match area {
                    Some(area) => fit_to_area(geometry, area),
                    None => geometry,
                };
                place_outer(window, target)?;
            }
            ensure_usable_size(window, area)?;
            if saved.maximized {
                window.maximize().map_err(|e| e.to_string())?;
            }
        }
        None => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                return Ok(());
            }
            ensure_usable_size(window, area)?;
            let Some(area) = area else { return Ok(()) };
            let current = outer_geometry(window)?;
            let fitted = fit_to_area(current, area);
            if fitted != current {
                place_outer(window, fitted)?;
            }
        }
    }
    Ok(())
}

fn apply_mini_window(window: &tauri::WebviewWindow, memory: &WindowMemory) -> Result<(), String> {
    remember_desktop_window(window, memory)?;
    window.set_always_on_bottom(false).map_err(|e| e.to_string())?;
    window.set_skip_taskbar(false).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window
        .set_min_size(Some(tauri::LogicalSize::new(280.0, 160.0)))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(320.0, 200.0))
        .map_err(|e| e.to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    if let Some(area) = work_area(window)? {
        let current = outer_geometry(window)?;
        let fitted = fit_to_area(current, area);
        if fitted != current {
            place_outer(window, fitted)?;
        }
    }
    Ok(())
}

/// Zen covers the whole monitor and stays behind every other window, acting as
/// a live wallpaper. It is removed from the taskbar; the tray icon brings it back.
fn apply_zen_window(window: &tauri::WebviewWindow, memory: &WindowMemory) -> Result<(), String> {
    remember_desktop_window(window, memory)?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window.set_min_size(None::<tauri::Size>).map_err(|e| e.to_string())?;
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        window.set_size(*monitor.size()).map_err(|e| e.to_string())?;
        // Windows keeps an invisible resize frame around the client area. Offset
        // the outer window by it so the visible content matches the monitor.
        let outer = window.outer_position().map_err(|e| e.to_string())?;
        let inner = window.inner_position().map_err(|e| e.to_string())?;
        let monitor_pos = monitor.position();
        window
            .set_position(PhysicalPosition::new(
                monitor_pos.x - (inner.x - outer.x),
                monitor_pos.y - (inner.y - outer.y),
            ))
            .map_err(|e| e.to_string())?;
    }
    window.set_skip_taskbar(true).map_err(|e| e.to_string())?;
    window.set_always_on_bottom(true).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_window_mode(
    app: tauri::AppHandle,
    memory: tauri::State<'_, WindowMemory>,
    mode: String,
) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("window not found")?;
    match mode.as_str() {
        "mini" => apply_mini_window(&window, &memory),
        "zen" => apply_zen_window(&window, &memory),
        "normal" | "flow" => apply_desktop_window(&window, &memory),
        other => Err(format!("unknown window mode: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Geometry = Geometry { x: 0, y: 0, width: 1366, height: 728 };

    #[test]
    fn minimized_window_frame_is_not_a_usable_geometry() {
        let minimized = Geometry { x: -32000, y: -32000, width: 160, height: 28 };
        assert!(!is_plausible_geometry(minimized));
        assert!(!is_plausible_geometry(Geometry { x: -32000, y: -32000, width: 1920, height: 1080 }));
        assert!(!is_plausible_geometry(Geometry { x: 0, y: 0, width: 160, height: 40 }));
    }

    #[test]
    fn regular_and_secondary_monitor_frames_are_usable() {
        assert!(is_plausible_geometry(Geometry { x: 170, y: 0, width: 1024, height: 768 }));
        assert!(is_plausible_geometry(Geometry { x: -1920, y: 40, width: 1280, height: 720 }));
    }

    #[test]
    fn detects_windows_smaller_than_the_desktop_minimum() {
        assert!(below_minimum(PhysicalSize::new(160, 40), 1.0));
        assert!(below_minimum(PhysicalSize::new(1000, 700), 1.5));
        assert!(!below_minimum(PhysicalSize::new(800, 600), 1.0));
        assert!(!below_minimum(PhysicalSize::new(1200, 900), 1.5));
    }

    #[test]
    fn fit_shrinks_window_taller_than_work_area() {
        let win = Geometry { x: 170, y: 0, width: 1024, height: 768 };
        let fitted = fit_to_area(win, AREA);
        assert_eq!(fitted.height, 728);
        assert_eq!(fitted.width, 1024);
        assert!(fitted.y + fitted.height as i32 <= 728);
    }

    #[test]
    fn fit_keeps_window_that_already_fits() {
        let win = Geometry { x: 100, y: 50, width: 800, height: 600 };
        assert_eq!(fit_to_area(win, AREA), win);
    }

    #[test]
    fn fit_moves_window_hanging_off_the_edges() {
        let win = Geometry { x: 1200, y: 600, width: 800, height: 600 };
        let fitted = fit_to_area(win, AREA);
        assert_eq!((fitted.x, fitted.y), (566, 128));
    }

    #[test]
    fn fit_handles_offset_work_area_and_offscreen_window() {
        let area = Geometry { x: 1920, y: 40, width: 1280, height: 720 };
        let win = Geometry { x: -500, y: -500, width: 2000, height: 900 };
        let fitted = fit_to_area(win, area);
        assert_eq!(fitted, area);
    }
}
