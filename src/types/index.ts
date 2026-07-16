export type Mode = "normal" | "flow" | "zen" | "mini";

export type RepeatMode = "off" | "all" | "one";

export interface Track {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface AppConfig {
  music_folder: string;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  last_track_index: number | null;
  last_position: number;
}

export interface PlaybackState {
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  current_track: string | null;
}
