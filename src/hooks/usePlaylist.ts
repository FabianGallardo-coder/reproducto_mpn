import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/api";
import { TRACK_ENDED, PLAYBACK_ERROR } from "../lib/events";
import type { Track, RepeatMode } from "../types";

export function usePlaylist() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const position = useRef(0);
  const [positionValue, setPositionValue] = useState(0);
  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] ?? null : null;

  const loadLibrary = useCallback(async (path: string) => {
    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      const result = await api.scanFolder(path);
      setTracks(result);
      setCurrentIndex(-1);
      setPlaying(false);
    } catch (error) {
      setError(`Failed to load library: ${error.message}`);
      setTracks([]); // Clear tracks on error
    } finally {
      setLoading(false);
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      // Find the index of the track optimistically
      const idx = tracks.findIndex((t) => t.path === track.path);
      if (idx < 0) return;
      setCurrentIndex(idx);
      setTrackLoading(true);
      try {
        await api.play(track.path);
        setPlaying(true);
        setError(null);
      } catch (error) {
        setError(String(error));
      } finally {
        setTrackLoading(false);
      }
    },
    [tracks],
  );

  const playAtIndex = useCallback(async (index: number) => {
    // Check if the index is valid optimistically
    if (index < 0 || index >= tracks.length) return;
    setCurrentIndex(index);
    setTrackLoading(true);
    try {
      await api.playIndex(index);
      setPlaying(true);
      setError(null);
    } catch (error) {
      setError(String(error));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks]);

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
    setTrackLoading(true);
    try {
      const track = await api.next();
      if (track) {
        const idx = tracks.findIndex((t) => t.path === track.path);
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
        setPlaying(true);
        setError(null);
      } else {
        setPlaying(false);
        setCurrentIndex(-1);
      }
    } catch (error) {
      setError(String(error));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks]);

  const previous = useCallback(async () => {
    setTrackLoading(true);
    try {
      const track = await api.previous();
      if (track) {
        const idx = tracks.findIndex((t) => t.path === track.path);
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
        setPlaying(true);
        setError(null);
      } else {
        setPlaying(false);
        setCurrentIndex(-1);
      }
    } catch (error) {
      setError(String(error));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks]);

  const setVolume = useCallback(async (v: number) => {
    await api.setVolume(v);
    setVolumeState(v);
  }, []);

  const seek = useCallback(async (pos: number) => {
    await api.seek(pos);
    position.current = pos;
    setPositionValue(pos);
  }, []);

  const toggleShuffle = useCallback(async () => {
    const next = !shuffle;
    await api.setShuffle(next);
    setShuffleState(next);
  }, [shuffle]);

  const setShuffle = useCallback(async (on: boolean) => {
    await api.setShuffle(on);
    setShuffleState(on);
  }, []);

  const cycleRepeat = useCallback(async () => {
    const next: RepeatMode = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    await api.setRepeat(next);
    setRepeatState(next);
  }, [repeat]);

  const setRepeat = useCallback(async (mode: RepeatMode) => {
    await api.setRepeat(mode);
    setRepeatState(mode);
  }, []);

  const search = useCallback(async (query: string): Promise<Track[]> => {
    if (!query.trim()) return tracks;
    return api.search(query);
  }, [tracks]);

  // Auto-advance on track end — respects repeat-one
  useEffect(() => {
    const unlisten = listen(TRACK_ENDED, async () => {
      if (repeat === "one") {
        await api.seek(0);
        position.current = 0;
        setPositionValue(0);
        await api.resume();
        setPlaying(true);
      } else {
        next();
      }
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, [next, repeat]);

  // Playback error listener
  useEffect(() => {
    const unlisten = listen<string>(PLAYBACK_ERROR, (e) => {
      setError(e.payload);
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  // Position polling when playing — updates seek bar DOM directly, zero re-renders
  // Also updates playing state and current track from backend to stay in sync
  useEffect(() => {
    if (playing) {
      positionInterval.current = setInterval(async () => {
        try {
          const state = await api.getState();
          position.current = state.position;
          setPositionValue(state.position);
          // Update playing state from backend
          setPlaying(state.playing);
          // Update current track from backend
          if (state.current_track) {
            const idx = tracks.findIndex((t) => t.path === state.current_track);
            if (idx >= 0) {
              setCurrentIndex(idx);
            }
          } else {
            setCurrentIndex(-1);
          }
        } catch (error) {
          setError(String(error));
        }
      }, 500);
    } else if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
    return () => {
      if (positionInterval.current) clearInterval(positionInterval.current);
    };
  }, [playing, tracks]);

  return {
    tracks,
    currentTrack,
    currentIndex,
    playing,
    volume,
    error,
    loading,
    trackLoading,
    shuffle,
    repeat,
    position,
    positionValue,
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
    toggleShuffle,
    setShuffle,
    cycleRepeat,
    setRepeat,
    search,
    clearError: () => setError(null),
  };
}