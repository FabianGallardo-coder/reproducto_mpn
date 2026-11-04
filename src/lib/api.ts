import { invoke, Channel } from "@tauri-apps/api/core";
import type { Track, AppConfig, PlaybackState, RepeatMode, RadioStation } from "../types";
import type { YouTubeCollection, YouTubeItem, YouTubeLibrary } from "../types/youtube";
import type { PlayHistoryEntry } from "../types/history";

export interface ScanProgress {
  processed: number;
  found: number;
  current: string;
}

export interface LrcLyrics {
  id: number;
  track_name: string;
  artist_name: string;
  instrumental: boolean;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
}

function logInvoke<T>(cmd: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  return fn().then(
    (v) => {
      if (import.meta.env.DEV) console.debug(`[ipc] ${cmd} ok (${Math.round(performance.now() - t0)}ms)`);
      return v;
    },
    (err) => {
      console.error(`[ipc] ${cmd} FAILED (${Math.round(performance.now() - t0)}ms)`, err);
      throw err;
    },
  );
}

export const api = {
  pause: () => logInvoke("pause", () => invoke<void>("pause")),
  resume: () => logInvoke("resume", () => invoke<void>("resume")),
  seek: (position: number) => logInvoke("seek", () => invoke<void>("seek", { position })),
  next: () => logInvoke("next", () => invoke<Track | null>("next")),
  previous: () => logInvoke("previous", () => invoke<Track | null>("previous")),
  setVolume: (volume: number) => logInvoke("set_volume", () => invoke<void>("set_volume", { volume })),
  getState: () => logInvoke("get_state", () => invoke<PlaybackState>("get_state")),
  setPlaylist: (tracks: Track[], index: number) =>
    logInvoke("set_playlist", () => invoke<void>("set_playlist", { tracks, index })),
  scanFolder: (path: string, onProgress?: (p: ScanProgress) => void) => {
    const channel = new Channel<ScanProgress>();
    if (onProgress) channel.onmessage = onProgress;
    return logInvoke("scan_folder", () => invoke<Track[]>("scan_folder", { path, onProgress: channel }));
  },
  getConfig: () => logInvoke("get_config", () => invoke<AppConfig>("get_config")),
  setConfig: (config: AppConfig) => logInvoke("set_config", () => invoke<void>("set_config", { config })),
  setShuffle: (on: boolean) => logInvoke("set_shuffle", () => invoke<void>("set_shuffle", { on })),
  setRepeat: (mode: RepeatMode) => logInvoke("set_repeat", () => invoke<void>("set_repeat", { mode })),
  search: (query: string) => logInvoke("search", () => invoke<Track[]>("search", { query })),
  playUrl: (url: string) => logInvoke("play_url", () => invoke<void>("play_url", { url })),
  listRadioStations: () => logInvoke("list_radio_stations", () => invoke<RadioStation[]>("list_radio_stations")),
  youtubeLibrary: () => logInvoke("youtube_library", () => invoke<YouTubeLibrary>("youtube_library")),
  youtubeSearch: (query: string, page: number) => logInvoke("youtube_search", () => invoke<YouTubeItem[]>("youtube_search", { query, page })),
  youtubeInspect: (url: string, playlist: boolean) => logInvoke("youtube_inspect", () => invoke<YouTubeCollection>("youtube_inspect", { url, playlist })),
  youtubeEnqueue: (collection: YouTubeCollection) => logInvoke("youtube_enqueue", () => invoke<string>("youtube_enqueue", { collection })),
  youtubeCancel: (id: string) => logInvoke("youtube_cancel", () => invoke<void>("youtube_cancel", { id })),
  youtubeRetry: (id: string) => logInvoke("youtube_retry", () => invoke<void>("youtube_retry", { id })),
  fetchLyrics: (artist: string, track: string, album?: string, duration?: number) =>
    logInvoke("fetch_lyrics", () => invoke<LrcLyrics>("fetch_lyrics", { artist, track, album: album ?? null, duration: duration ?? null })),
  getCover: (path: string) => logInvoke("get_cover", () => invoke<number[] | null>("get_cover", { path })),
  getTrackInfo: (path: string) => logInvoke("get_track_info", () => invoke<Track>("get_track_info", { path })),
  setWindowMode: (mode: string) => logInvoke("set_window_mode", () => invoke<void>("set_window_mode", { mode })),
  recordPlay: (entry: PlayHistoryEntry) => logInvoke("record_play", () => invoke<void>("record_play", { entry })),
  getHistory: () => logInvoke("get_history", () => invoke<PlayHistoryEntry[]>("get_history")),
  clearHistory: () => logInvoke("clear_history", () => invoke<void>("clear_history")),
  updateSmtcMetadata: (title: string, artist: string, album: string, duration: number) =>
    logInvoke("update_smtc_metadata", () => invoke<void>("update_smtc_metadata", { title, artist, album, duration })),
};
