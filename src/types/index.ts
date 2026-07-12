export type Mode = "normal" | "flow" | "zen";

export interface Track {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface AppConfig {
  music_folder: string;
  mode: Mode;
  volume: number;
  crossfade_duration: number;
}
