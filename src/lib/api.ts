import { invoke, Channel } from "@tauri-apps/api/core";
import type { Track, AppConfig, PlaybackState, RepeatMode } from "../types";

export interface AudioData {
  bins: number[];
}

export interface RadioStation {
  name: string;
  genre: string;
  url: string;
  description: string;
}

export interface ScanProgress {
  processed: number;
  found: number;
  current: string;
}

export interface YouTubeMeta {
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

export interface LrcLyrics {
  id: number;
  track_name: string;
  artist_name: string;
  instrumental: boolean;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
}

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
  scanFolder: (path: string, onProgress?: (p: ScanProgress) => void) => {
    const channel = new Channel<ScanProgress>();
    if (onProgress) channel.onmessage = onProgress;
    return invoke<Track[]>("scan_folder", { path, onProgress: channel });
  },
  getConfig: () => invoke<AppConfig>("get_config"),
  setConfig: (config: AppConfig) => invoke<void>("set_config", { config }),
  setShuffle: (on: boolean) => invoke<void>("set_shuffle", { on }),
  getShuffle: () => invoke<boolean>("get_shuffle"),
  setRepeat: (mode: RepeatMode) => invoke<void>("set_repeat", { mode }),
  getRepeat: () => invoke<RepeatMode>("get_repeat"),
  search: (query: string) => invoke<Track[]>("search", { query }),
  getAudioData: () => invoke<AudioData>("get_audio_data"),
  playUrl: (url: string) => invoke<void>("play_url", { url }),
  listRadioStations: () => invoke<RadioStation[]>("list_radio_stations"),
  youtubeMetadata: (url: string) => invoke<YouTubeMeta>("youtube_metadata", { url }),
  youtubeStreamUrl: (url: string) => invoke<string>("youtube_stream_url", { url }),
  fetchLyrics: (artist: string, track: string, album?: string, duration?: number) =>
    invoke<LrcLyrics>("fetch_lyrics", { artist, track, album: album ?? null, duration: duration ?? null }),
  getCover: (path: string) => invoke<number[] | null>("get_cover", { path }),
  setWindowDecorations: (enabled: boolean) => invoke<void>("set_window_decorations", { enabled }),
};
