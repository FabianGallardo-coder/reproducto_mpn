import { useEffect, useRef } from "react";
import type { Track } from "../types";
import { isAndroid } from "../lib/platform";

interface MediaSessionActions {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
}

export function useMediaSession(
  currentTrack: Track | null,
  playing: boolean,
  position: number,
  actions: MediaSessionActions,
) {
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    if (isAndroid || !("mediaSession" in navigator)) return;

    const ns = navigator.mediaSession;

    if (currentTrack) {
      ns.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
      });
    } else {
      ns.metadata = null;
    }

    ns.setActionHandler("play", actions.onPlay);
    ns.setActionHandler("pause", actions.onPause);
    ns.setActionHandler("nexttrack", actions.onNext);
    ns.setActionHandler("previoustrack", actions.onPrevious);
    ns.setActionHandler("seekto", (e) => {
      if (e.seekTime != null) actions.onSeek(e.seekTime);
    });
    ns.setActionHandler("seekbackward", (e) => {
      actions.onSeek(Math.max(0, positionRef.current - (e.seekOffset ?? 10)));
    });
    ns.setActionHandler("seekforward", (e) => {
      actions.onSeek(positionRef.current + (e.seekOffset ?? 10));
    });

    ns.playbackState = playing ? "playing" : "paused";

    return () => {
      ns.setActionHandler("play", null);
      ns.setActionHandler("pause", null);
      ns.setActionHandler("nexttrack", null);
      ns.setActionHandler("previoustrack", null);
      ns.setActionHandler("seekto", null);
      ns.setActionHandler("seekbackward", null);
      ns.setActionHandler("seekforward", null);
    };
  }, [currentTrack, playing, actions.onPlay, actions.onPause, actions.onNext, actions.onPrevious, actions.onSeek]);
}
