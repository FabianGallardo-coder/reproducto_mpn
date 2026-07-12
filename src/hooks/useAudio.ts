import { useState, useCallback } from "react";
import { api } from "../lib/api";
import type { Track } from "../types";

export function useAudio() {
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolumeState] = useState(0.8);

  const play = useCallback(async (track: Track) => {
    await api.play(track.path);
    setPlaying(true);
    setCurrentTrack(track);
  }, []);

  const pause = useCallback(async () => {
    await api.pause();
    setPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    await api.resume();
    setPlaying(true);
  }, []);

  const toggle = useCallback(async () => {
    if (playing) {
      await pause();
    } else {
      await resume();
    }
  }, [playing, pause, resume]);

  const setVolume = useCallback(async (v: number) => {
    await api.setVolume(v);
    setVolumeState(v);
  }, []);

  const next = useCallback(async () => {
    await api.next();
  }, []);

  const previous = useCallback(async () => {
    await api.previous();
  }, []);

  return {
    playing,
    currentTrack,
    volume,
    play,
    pause,
    resume,
    toggle,
    setVolume,
    next,
    previous,
  };
}
