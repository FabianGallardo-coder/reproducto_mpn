import { useCallback } from "react";
import { usePlayerActions } from "./usePlayerStore";
import { trackYouTubeItem } from "../types/youtube";
import type { Track } from "../types";

/** Starts playback of any kind of track (local file, online YouTube video or radio stream). */
export function usePlayAnyTrack() {
  const { playCollection, playYouTube, playVirtualTrack } = usePlayerActions();

  return useCallback(
    (track: Track, queue: Track[] = [track]) => {
      const video = trackYouTubeItem(track);
      if (video) {
        const items = queue.flatMap((entry) => trackYouTubeItem(entry) ?? []);
        return playYouTube(video, items.length ? items : [video]);
      }
      if (/^https?:\/\//i.test(track.path)) return playVirtualTrack(track);
      const index = queue.findIndex((entry) => entry.path === track.path);
      return playCollection(queue, Math.max(0, index));
    },
    [playCollection, playYouTube, playVirtualTrack],
  );
}
