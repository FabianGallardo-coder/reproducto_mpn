import { invoke } from "@tauri-apps/api/core";
import type { Track, AppConfig, PlaybackState } from "../types";

export const api = {
  play: (path: string) => invoke<void>("play", { path }),
  playIndex: (index: number) => invoke<Track | null>("play_index", { index }),
  pause: () => invoke<void>("pause"),
  resume: () => invoke<void>("resume"),
  seek: (position: number) => invoke<void>("seek", { position }),
  next: () => invoke<Track | null>("next"),
  previous: () => invoke<Track | null>("previous"),
  setVolume: (volume: number) => invoke<void>("set_volume", { volume }),
  getState: () => invoke<PlaybackState>("get_state"),
  getPlaylist: () => invoke<Track[]>("get_playlist"),
  setPlaylist: (tracks: Track[], index: number) =>
    invoke<void>("set_playlist", { tracks, index }),
  scanFolder: (path: string) => invoke<Track[]>("scan_folder", { path }),
  getTracks: (path: string) => invoke<Track[]>("get_tracks", { path }),
  getConfig: () => invoke<AppConfig>("get_config"),
  setConfig: (config: AppConfig) => invoke<void>("set_config", { config }),
};
