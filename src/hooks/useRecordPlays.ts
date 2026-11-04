import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { usePlayerState } from "./usePlayerStore";
import { HISTORY_CHANGED_EVENT } from "./usePlayHistory";
import type { PlayHistoryEntry, PlaySource } from "../types/history";
import type { Track } from "../types";
import { youtubeIdFromPath } from "../types/youtube";

export function sourceOf(track: Track): PlaySource {
  if (youtubeIdFromPath(track.path) || track.album === "YouTube") return "youtube";
  if (/^https?:\/\//i.test(track.path)) return "radio";
  return "local";
}

export function toHistoryEntry(track: Track, playedAt: number): PlayHistoryEntry {
  return {
    path: track.path,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    source: sourceOf(track),
    playedAt,
  };
}

/** Records one history entry each time a different track starts playing. */
export function useRecordPlays(): void {
  const { currentTrack, playing } = usePlayerState();
  const lastRecorded = useRef<string | null>(null);
  const path = currentTrack?.path ?? null;

  useEffect(() => {
    if (!currentTrack || !path) {
      lastRecorded.current = null;
      return;
    }
    if (!playing || lastRecorded.current === path) return;
    lastRecorded.current = path;
    api
      .recordPlay(toHistoryEntry(currentTrack, Date.now()))
      .then(() => window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT)))
      .catch((error) => console.error("No se pudo guardar el historial:", error));
    // Only a different path (or the first time it plays) should create an entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, playing]);
}
