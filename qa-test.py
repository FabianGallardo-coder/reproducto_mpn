from playwright.sync_api import sync_playwright
import os, datetime

SCREENSHOT_DIR = "qa-screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TAURI_MOCKS = """
// Tauri v2 requires __TAURI_INTERNALS__ with specific structure
window.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    const commands = {
      play: async () => {},
      pause: async () => {},
      resume: async () => {},
      seek: async () => {},
      next: async () => null,
      previous: async () => null,
      set_volume: async () => {},
      get_state: async () => ({ playing: false, position: 0, duration: 0, volume: 0.8, current_track: null }),
      get_playlist: async () => [],
      set_playlist: async () => {},
      scan_folder: async () => [
        { path: "C:\\\\music\\\\song1.mp3", title: "Midnight Dreams", artist: "Luna Echo", album: "Nocturnal", duration: 245 },
        { path: "C:\\\\music\\\\song2.mp3", title: "Summer Rain", artist: "The Waves", album: "Tides", duration: 198 },
        { path: "C:\\\\music\\\\song3.mp3", title: "Neon Lights", artist: "Synthwave Collective", album: "Retrograde", duration: 312 },
        { path: "C:\\\\music\\\\song4.mp3", title: "Wild Forest", artist: "Nature Sounds", album: "Ambient", duration: 420 },
        { path: "C:\\\\music\\\\song5.mp3", title: "City Nights", artist: "Urban Flow", album: "Metropolis", duration: 267 },
        { path: "C:\\\\music\\\\song6.mp3", title: "Ocean Breeze", artist: "Coastal", album: "Seaside", duration: 185 },
        { path: "C:\\\\music\\\\song7.mp3", title: "Electric Soul", artist: "Volt", album: "Circuit", duration: 230 },
        { path: "C:\\\\music\\\\song8.mp3", title: "Starlight", artist: "Cosmos", album: "Galaxy", duration: 290 },
        { path: "C:\\\\music\\\\song9.mp3", title: "Deep Blue", artist: "Aqua", album: "Depths", duration: 340 },
        { path: "C:\\\\music\\\\song10.mp3", title: "Golden Hour", artist: "Sunset", album: "Horizon", duration: 215 },
      ],
      get_config: async () => ({ music_folder: "C:\\\\music", volume: 0.8, shuffle: false, repeat: "off", last_track_index: null, last_position: 0 }),
      set_config: async () => {},
      set_shuffle: async () => {},
      get_shuffle: async () => false,
      set_repeat: async () => {},
      get_repeat: async () => "off",
      search: async () => [],
      get_audio_data: async () => ({ bins: Array(64).fill(0).map(() => Math.random() * 0.5) }),
      play_url: async () => {},
      list_radio_stations: async () => [
        { name: "Lofi Hip Hop", genre: "Lofi", url: "http://example.com/lofi", description: "Chill beats" },
        { name: "Jazz FM", genre: "Jazz", url: "http://example.com/jazz", description: "Smooth jazz" },
        { name: "Classical 98.7", genre: "Classical", url: "http://example.com/classical", description: "Orchestral" },
      ],
      youtube_metadata: async () => ({ title: "", artist: "", duration: 0, thumbnail: "" }),
      youtube_stream_url: async () => "",
      fetch_lyrics: async () => ({ id: 1, track_name: "", artist_name: "", instrumental: false, plain_lyrics: null, synced_lyrics: null }),
      get_cover: async () => null,
      set_window_decorations: async () => {},
      play_index: async (args) => {
        const tracks = await commands.scan_folder();
        return tracks[args.index] || null;
      },
    };
    return commands[cmd] ? await commands[cmd](args) : null;
  },
  transformCallback: (cb, once) => 1,
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main" },
  },
  // Channel plugin mock
  plugins: {},
};

window.__TAURI__ = {
  core: { invoke: window.__TAURI_INTERNALS__.invoke },
  event: {
    listen: async (event, handler) => () => {},
  },
  window: {
    getCurrentWindow: () => ({
      show: async () => {},
      hide: async () => {},
      close: async () => {},
      label: "main",
    }),
  },
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: () => {},
};

// Mock plugin-dialog internal channel
window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
  // Intercept dialog commands
  if (cmd === 'plugin:dialog|open') return null;
  if (cmd === 'plugin:dialog|message') return null;
  if (cmd === 'plugin:dialog|ask') return false;
  if (cmd === 'plugin:dialog|confirm') return false;
  
  // App commands
  const commands = {
    play: async () => {},
    pause: async () => {},
    resume: async () => {},
    seek: async () => {},
    next: async () => null,
    previous: async () => null,
    set_volume: async () => {},
    get_state: async () => ({ playing: false, position: 0, duration: 0, volume: 0.8, current_track: null }),
    get_playlist: async () => [],
    set_playlist: async () => {},
    scan_folder: async () => [
      { path: "C:\\\\music\\\\song1.mp3", title: "Midnight Dreams", artist: "Luna Echo", album: "Nocturnal", duration: 245 },
      { path: "C:\\\\music\\\\song2.mp3", title: "Summer Rain", artist: "The Waves", album: "Tides", duration: 198 },
      { path: "C:\\\\music\\\\song3.mp3", title: "Neon Lights", artist: "Synthwave Collective", album: "Retrograde", duration: 312 },
      { path: "C:\\\\music\\\\song4.mp3", title: "Wild Forest", artist: "Nature Sounds", album: "Ambient", duration: 420 },
      { path: "C:\\\\music\\\\song5.mp3", title: "City Nights", artist: "Urban Flow", album: "Metropolis", duration: 267 },
      { path: "C:\\\\music\\\\song6.mp3", title: "Ocean Breeze", artist: "Coastal", album: "Seaside", duration: 185 },
      { path: "C:\\\\music\\\\song7.mp3", title: "Electric Soul", artist: "Volt", album: "Circuit", duration: 230 },
      { path: "C:\\\\music\\\\song8.mp3", title: "Starlight", artist: "Cosmos", album: "Galaxy", duration: 290 },
      { path: "C:\\\\music\\\\song9.mp3", title: "Deep Blue", artist: "Aqua", album: "Depths", duration: 340 },
      { path: "C:\\\\music\\\\song10.mp3", title: "Golden Hour", artist: "Sunset", album: "Horizon", duration: 215 },
    ],
    get_config: async () => ({ music_folder: "C:\\\\music", volume: 0.8, shuffle: false, repeat: "off", last_track_index: null, last_position: 0 }),
    set_config: async () => {},
    set_shuffle: async () => {},
    get_shuffle: async () => false,
    set_repeat: async () => {},
    get_repeat: async () => "off",
    search: async () => [],
    get_audio_data: async () => ({ bins: Array(64).fill(0).map(() => Math.random() * 0.5) }),
    play_url: async () => {},
    list_radio_stations: async () => [
      { name: "Lofi Hip Hop", genre: "Lofi", url: "http://example.com/lofi", description: "Chill beats" },
      { name: "Jazz FM", genre: "Jazz", url: "http://example.com/jazz", description: "Smooth jazz" },
      { name: "Classical 98.7", genre: "Classical", url: "http://example.com/classical", description: "Orchestral" },
    ],
    youtube_metadata: async () => ({ title: "", artist: "", duration: 0, thumbnail: "" }),
    youtube_stream_url: async () => "",
    fetch_lyrics: async () => ({ id: 1, track_name: "", artist_name: "", instrumental: false, plain_lyrics: null, synced_lyrics: null }),
    get_cover: async () => null,
    set_window_decorations: async () => {},
    play_index: async (args) => {
      const tracks = await commands.scan_folder();
      return tracks[args.index] || null;
    },
  };
  return commands[cmd] ? await commands[cmd](args) : null;
};

// Ensure navigator.mediaSession exists
if (!('mediaSession' in navigator)) {
  Object.defineProperty(navigator, 'mediaSession', {
    value: {
      metadata: null,
      playbackState: 'paused',
      setActionHandler: () => {},
    },
    writable: true,
    configurable: true,
  });
}
"""


def screenshot(page, name):
    path = f"{SCREENSHOT_DIR}/{name}.png"
    page.screenshot(path=path, full_page=False)
    return path


results = []


def test(name, passed, screenshot_path="", notes=""):
    results.append({"test": name, "pass": passed, "screenshot": screenshot_path, "notes": notes})
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {name}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    page.add_init_script(TAURI_MOCKS)

    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(str(err)))

    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)

    # Debug: check if app rendered
    root_html = page.inner_html("#root")
    if len(root_html) < 100:
        print(f"[DEBUG] Root HTML too short ({len(root_html)} chars): {root_html[:200]}")
        print(f"[DEBUG] Console errors: {console_errors[:5]}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/debug-render.png")

    # ── MODE TESTS ──
    print("\n=== MODE TESTS ===")

    path = screenshot(page, "01-normal-mode")
    test("Normal mode - sidebar visible", page.locator(".sidebar").count() > 0, path)
    test("Normal mode - player bar visible", page.locator(".player-bar").count() > 0, path)
    test("Normal mode - layout class", page.locator(".layout--normal").count() > 0, path)
    test("Normal mode - track list", page.locator(".track-list, .normal-view__list").count() > 0, path)

    # Flow mode
    flow_btn = page.locator('[aria-label="flow mode"]')
    if flow_btn.count() > 0:
        flow_btn.click()
        page.wait_for_timeout(800)
        path = screenshot(page, "02-flow-mode")
        test("Flow mode - layout class", page.locator(".layout--flow").count() > 0, path)
        test("Flow mode - sidebar collapsed", page.locator(".sidebar--collapsed").count() > 0, path)
        test("Flow mode - flow view", page.locator(".flow-view").count() > 0, path)
        test("Flow mode - pomodoro", page.locator(".pomodoro").count() > 0, path)
    else:
        test("Flow mode button exists", False)

    # Zen mode
    zen_btn = page.locator('[aria-label="zen mode"]')
    if zen_btn.count() > 0:
        zen_btn.click()
        page.wait_for_timeout(1000)
        path = screenshot(page, "03-zen-mode")
        test("Zen mode - layout class", page.locator(".layout--zen").count() > 0, path)
        test("Zen mode - zen view", page.locator(".zen-view").count() > 0, path)
        test("Zen mode - canvas", page.locator("canvas").count() > 0, path)
        test("Zen mode - exit button", page.locator(".zen-exit").count() > 0, path)
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        path = screenshot(page, "04-zen-exit")
        test("Zen exit via Escape", page.locator(".layout--normal").count() > 0, path)
    else:
        test("Zen mode button exists", False)

    # Mini mode
    mini_btn = page.locator('[aria-label="mini mode"]')
    if mini_btn.count() > 0:
        mini_btn.click()
        page.wait_for_timeout(800)
        path = screenshot(page, "04b-mini-mode")
        test("Mini mode - layout class", page.locator(".layout--mini").count() > 0, path)
        test("Mini mode - mini view", page.locator(".mini-view").count() > 0, path)
        test("Mini mode - card rendered", page.locator(".mini-view__card").count() > 0, path)
        test("Mini mode - expand button", page.locator(".mini-view__expand").count() > 0, path)
        test("Mini mode - controls", page.locator(".mini-view__controls").count() > 0, path)
        test("Mini mode - seek bar", page.locator(".mini-view__seek").count() > 0, path)
        # Click expand button to return to normal
        page.locator(".mini-view__expand").click()
        page.wait_for_timeout(600)
        path = screenshot(page, "04c-mini-expand")
        test("Mini expand -> normal", page.locator(".layout--normal").count() > 0, path)
    else:
        test("Mini mode button exists", False)

    # ── INTERACTIONS ──
    print("\n=== INTERACTIONS ===")

    search = page.locator(".sidebar__search")
    if search.count() > 0:
        search.fill("test")
        page.wait_for_timeout(400)
        path = screenshot(page, "05-search")
        test("Search input works", search.input_value() == "test", path)
        search.fill("")
    else:
        test("Search input exists", False)

    radio_tab = page.locator(".sidebar__tab", has_text="Radio")
    if radio_tab.count() > 0:
        radio_tab.click()
        page.wait_for_timeout(600)
        path = screenshot(page, "06-radio")
        test("Radio tab renders panel", page.locator(".radio-panel").count() > 0, path)
        lib_tab = page.locator(".sidebar__tab", has_text="Library")
        if lib_tab.count() > 0:
            lib_tab.click()
            page.wait_for_timeout(300)
    else:
        test("Radio tab exists", False)

    yt_tab = page.locator(".sidebar__tab", has_text="YT")
    if yt_tab.count() > 0:
        yt_tab.click()
        page.wait_for_timeout(400)
        path = screenshot(page, "06b-youtube")
        test("YouTube tab renders panel", page.locator(".youtube-panel").count() > 0, path)
        test("YouTube URL input exists", page.locator(".youtube-panel__input").count() > 0, path)
        test("YouTube play button exists", page.locator(".youtube-panel__btn").count() > 0, path)
        lib_tab = page.locator(".sidebar__tab", has_text="Library")
        if lib_tab.count() > 0:
            lib_tab.click()
            page.wait_for_timeout(300)
    else:
        test("YouTube tab exists", False)

    vol = page.locator('[aria-label="Volume"]')
    test("Volume slider present", vol.count() > 0, notes=f"count={vol.count()}")

    play_btn = page.locator(".player-bar__btn--play")
    if play_btn.count() > 0:
        path = screenshot(page, "07-play")
        test("Play button present", play_btn.is_visible(), path)
        play_btn.click()
        page.wait_for_timeout(300)
    else:
        test("Play button exists", False)

    test("Shuffle button", page.locator('[aria-label="Toggle shuffle"]').count() > 0)
    test("Repeat button", page.locator('[aria-label^="Repeat"]').count() > 0)

    # ── EDGE CASES ──
    print("\n=== EDGE CASES ===")
    path = screenshot(page, "08-state")
    test("Track list or empty state", page.locator(".track-list__item, .track-list__empty").count() > 0, path)
    test("Now-playing panel", page.locator(".normal-view__now-playing").count() > 0)

    # ── VISUAL EFFECTS ──
    print("\n=== VISUAL EFFECTS ===")
    test("Background blur layer", page.locator(".app-bg").count() > 0)

    sb = page.locator(".sidebar")
    if sb.count() > 0:
        bf = sb.evaluate("el => getComputedStyle(el).backdropFilter || 'none'")
        test("Sidebar glass effect", "blur" in bf, notes=f"filter: {bf}")
    else:
        test("Sidebar glass effect", False)

    pb = page.locator(".player-bar")
    if pb.count() > 0:
        bf = pb.evaluate("el => getComputedStyle(el).backdropFilter || 'none'")
        test("Player bar glass effect", "blur" in bf, notes=f"filter: {bf}")
    else:
        test("Player bar glass effect", False)

    # ── RESPONSIVE ──
    print("\n=== RESPONSIVE ===")
    page.set_viewport_size({"width": 700, "height": 600})
    page.wait_for_timeout(600)
    path = screenshot(page, "09-700px")
    test("700px viewport intact", page.locator(".layout").count() > 0, path)

    page.set_viewport_size({"width": 1400, "height": 900})
    page.wait_for_timeout(600)
    path = screenshot(page, "10-1400px")
    test("1400px viewport intact", page.locator(".layout").count() > 0, path)
    page.set_viewport_size({"width": 1280, "height": 800})
    page.wait_for_timeout(300)

    # ── KEYBOARD SHORTCUTS ──
    print("\n=== KEYBOARD SHORTCUTS ===")
    page.keyboard.press("Alt+f")
    page.wait_for_timeout(600)
    test("Alt+F -> flow", page.locator(".layout--flow").count() > 0)

    page.keyboard.press("Alt+n")
    page.wait_for_timeout(600)
    test("Alt+N -> normal", page.locator(".layout--normal").count() > 0)

    page.keyboard.press("Alt+z")
    page.wait_for_timeout(600)
    test("Alt+Z -> zen", page.locator(".layout--zen").count() > 0)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)

    page.keyboard.press("Alt+m")
    page.wait_for_timeout(600)
    test("Alt+M -> mini", page.locator(".layout--mini").count() > 0)
    page.keyboard.press("Alt+n")
    page.wait_for_timeout(400)

    # ── ERRORS ──
    print("\n=== ERROR CHECK ===")
    real_errors = [e for e in console_errors if "vite" not in e.lower() and "react-devtools" not in e.lower()]
    test("No console errors", len(real_errors) == 0, notes=f"{len(real_errors)} errors" + (f": {real_errors[0][:80]}" if real_errors else ""))

    browser.close()

# ── Summary ──
print("\n" + "=" * 60)
passed = sum(1 for r in results if r["pass"])
total = len(results)
print(f"RESULTS: {passed}/{total} passed, {total - passed} failed")
print("=" * 60)
for i, r in enumerate(results, 1):
    s = "PASS" if r["pass"] else "FAIL"
    print(f"  [{s}] {i:2d}. {r['test']}" + (f" -- {r['notes']}" if r["notes"] else ""))

# ── Write registry ──
os.makedirs(".opencode/registries", exist_ok=True)
registry_path = ".opencode/registries/frontend-qa.md"
ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
entry = f"\n## [{ts}] QA Run -- {passed}/{total} passed\n\n"
entry += "| # | Test | Result | Screenshot | Notes |\n|---|------|--------|------------|-------|\n"
for i, r in enumerate(results, 1):
    s = "PASS" if r["pass"] else "FAIL"
    sc = r["screenshot"].replace("\\", "/") if r["screenshot"] else "-"
    n = (r["notes"] or "-").replace("|", "/")
    entry += f"| {i} | {r['test']} | {s} | {sc} | {n} |\n"
entry += f"\n**Summary:** {passed}/{total} tests passed.\n"

mode = "a" if os.path.exists(registry_path) else "w"
with open(registry_path, mode, encoding="utf-8") as f:
    if mode == "w":
        f.write("# Frontend QA Registry\n\n")
    f.write(entry)
print(f"\nResults logged to {registry_path}")
