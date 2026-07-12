import { invoke } from "@tauri-apps/api/core";
import type { Track, AppConfig } from "../types";

export const api = {
  play: (path: string) => invoke<void>("play", { path }),
  pause: () => invoke<void>("pause"),
  resume: () => invoke<void>("resume"),
  seek: (position: number) => invoke<void>("seek", { position }),
  next: () => invoke<void>("next"),
  previous: () => invoke<void>("previous"),
  setVolume: (volume: number) => invoke<void>("set_volume", { volume }),
  scanFolder: (path: string) => invoke<Track[]>("scan_folder", { path }),
  getTracks: (path: string) => invoke<Track[]>("get_tracks", { path }),
  getConfig: () => invoke<AppConfig>("get_config"),
  setConfig: (config: AppConfig) => invoke<void>("set_config", { config }),
};
