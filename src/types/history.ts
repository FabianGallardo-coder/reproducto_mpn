export type PlaySource = "local" | "youtube" | "radio";

export interface PlayHistoryEntry {
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  source: PlaySource;
  /** Unix epoch in milliseconds. */
  playedAt: number;
}
