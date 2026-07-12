import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/api";
import type { Track } from "../types";

export function usePlaylist() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] ?? null : null;

  const loadLibrary = useCallback(async (path: string) => {
    const result = await api.scanFolder(path);
    setTracks(result);
    setCurrentIndex(-1);
    setPlaying(false);
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      const idx = tracks.findIndex((t) => t.path === track.path);
      if (idx < 0) return;
      setCurrentIndex(idx);
      setPlaying(true);
      setError(null);
      await api.play(track.path);
    },
    [tracks],
  );

  const playAtIndex = useCallback(async (index: number) => {
    const track = await api.playIndex(index);
    if (track) {
      setCurrentIndex(index);
      setPlaying(true);
      setError(null);
    }
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

  const next = useCallback(async () => {
    const track = await api.next();
    if (track) {
      const idx = tracks.findIndex((t) => t.path === track.path);
      if (idx >= 0) setCurrentIndex(idx);
      setPlaying(true);
      setError(null);
    } else {
      setPlaying(false);
    }
  }, [tracks]);

  const previous = useCallback(async () => {
    const track = await api.previous();
    if (track) {
      const idx = tracks.findIndex((t) => t.path === track.path);
      if (idx >= 0) setCurrentIndex(idx);
      setPlaying(true);
      setError(null);
    }
  }, [tracks]);

  const setVolume = useCallback(async (v: number) => {
    await api.setVolume(v);
    setVolumeState(v);
  }, []);

  const seek = useCallback(async (position: number) => {
    await api.seek(position);
    setPosition(position);
  }, []);

  // Auto-advance on track end
  useEffect(() => {
    const unlisten = listen("track-ended", () => {
      next();
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, [next]);

  // Playback error listener
  useEffect(() => {
    const unlisten = listen<string>("playback-error", (e) => {
      setError(e.payload);
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  // Position polling when playing
  useEffect(() => {
    if (playing) {
      positionInterval.current = setInterval(async () => {
        const state = await api.getState();
        setPosition(state.position);
      }, 500);
    } else if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
    return () => {
      if (positionInterval.current) clearInterval(positionInterval.current);
    };
  }, [playing]);

  return {
    tracks,
    currentTrack,
    currentIndex,
    playing,
    volume,
    error,
    position,
    loadLibrary,
    playTrack,
    playAtIndex,
    pause,
    resume,
    toggle,
    next,
    previous,
    setVolume,
    seek,
    clearError: () => setError(null),
  };
}
