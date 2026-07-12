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
  volume: number;
  crossfade_duration: number;
}

export interface PlaybackState {
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  current_track: string | null;
}
