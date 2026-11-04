import type { Page } from "@playwright/test";

export interface MockTrack {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface TauriMockOptions {
  tracks?: MockTrack[];
  favorites?: string[];
  customPlaylists?: { name: string; tracks: string[] }[];
  musicFolder?: string;
  /** Extra command handlers (serializable source strings are not supported; use `responses`). */
  responses?: Record<string, unknown>;
  failures?: Record<string, string>;
}

declare global {
  interface Window {
    __TAURI_MOCK_CALLS__?: { command: string; args?: Record<string, unknown> }[];
  }
}
export const SAMPLE_TRACKS: MockTrack[] = [
  { path: "C:\\Music\\Blue Hour.mp3", title: "Blue Hour", artist: "Northbound", album: "Night Drive", duration: 205 },
  { path: "C:\\Music\\Afterglow.mp3", title: "Afterglow", artist: "Northbound", album: "Night Drive", duration: 190 },
  { path: "C:\\Music\\Paper Moons.mp3", title: "Paper Moons", artist: "Lumen", album: "Paper Moons", duration: 232 },
  { path: "C:\\Music\\Static Bloom.mp3", title: "Static Bloom", artist: "Lumen", album: "Static Bloom", duration: 178 },
];

/**
 * Replaces the Tauri IPC bridge so the Vite dev server can be exercised in a plain browser.
 * Every command resolves with a sensible default unless overridden through `responses`.
 */
export async function mockTauri(page: Page, options: TauriMockOptions = {}): Promise<void> {
  const tracks = options.tracks ?? SAMPLE_TRACKS;
  const config = {
    music_folder: options.musicFolder ?? "C:\\Music",
    volume: 0.8,
    shuffle: false,
    repeat: "off",
    last_track_index: null,
    last_position: 0,
    favorites: options.favorites ?? [],
    custom_playlists: options.customPlaylists ?? [],
    custom_radio_stations: [],
  };
  const responses: Record<string, unknown> = {
    get_config: config,
    scan_folder: tracks,
    list_radio_stations: [
      { name: "Groove Salad", genre: "Ambient", url: "https://example.test/groove", description: "Chill beats" },
      { name: "Secret Agent", genre: "Lounge", url: "https://example.test/agent", description: "Spy jazz" },
    ],
    youtube_library: { version: 1, songs: [], playlists: [], jobs: [] },
    youtube_search: [],
    get_state: { playing: false, position: 0, duration: 0, volume: 0.8, current_track: null },
    get_cover: null,
    get_history: [],
    ...options.responses,
  };

  await page.addInitScript(({ responses: initial, failures }) => {
    let nextCallback = 1;
    const callbacks = new Map<number, (payload: unknown) => void>();
    const win = window as unknown as Record<string, unknown>;
    const calls: { command: string; args?: Record<string, unknown> }[] = [];
    window.__TAURI_MOCK_CALLS__ = calls;
    win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    win.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { windowLabel: "main", label: "main" },
      },
      transformCallback(callback: (payload: unknown) => void) {
        const id = nextCallback++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback(id: number) {
        callbacks.delete(id);
      },
      convertFileSrc: (path: string) => path,
      async invoke(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });
        if (command in failures) throw new Error(failures[command]);
        if (command === "plugin:event|listen") return nextCallback++;
        if (command in (initial as Record<string, unknown>)) return (initial as Record<string, unknown>)[command];
        return null;
      },
    };
  }, { responses, failures: options.failures ?? {} });
}
