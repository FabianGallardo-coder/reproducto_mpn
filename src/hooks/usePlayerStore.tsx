import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/api";
import { TRACK_ENDED, PLAYBACK_ERROR } from "../lib/events";
import type { Track, RepeatMode } from "../types";

/**
 * Player state + actions, exposed via React Context to eliminate the
 * `App → AppLayout → PlayerBar` prop drilling.
 */
export interface PlayerState {
  // Read state
  tracks: Track[];
  currentIndex: number;
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  error: string | null;
  loading: boolean;
  trackLoading: boolean;
  scanProgress: { processed: number; found: number } | null;
  shuffle: boolean;
  repeat: RepeatMode;
  positionValue: number;
  // Refs are not part of state, but consumers may want the current value
  positionRef: React.MutableRefObject<number>;
}

export interface PlayerActions {
  loadLibrary: (path: string) => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  playAtIndex: (index: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  seek: (pos: number) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  setShuffle: (on: boolean) => Promise<void>;
  cycleRepeat: () => Promise<void>;
  setRepeat: (mode: RepeatMode) => Promise<void>;
  search: (query: string) => Promise<Track[]>;
  clearError: () => void;
}

const PlayerStateContext = createContext<PlayerState | null>(null);
const PlayerActionsContext = createContext<PlayerActions | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const [scanProgress, setScanProgress] = useState<{
    processed: number;
    found: number;
  } | null>(null);
  const positionRef = useRef(0);
  const [positionValue, setPositionValue] = useState(0);
  const positionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] ?? null : null;

  const loadLibrary = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setScanProgress(null);
    try {
      const result = await api.scanFolder(path, (p) => {
        setScanProgress({ processed: p.processed, found: p.found });
      });
      setTracks(result);
      setCurrentIndex(-1);
      setPlaying(false);
    } catch (err) {
      setError(
        `Failed to load library: ${(err as Error).message ?? String(err)}`,
      );
      setTracks([]);
    } finally {
      setLoading(false);
      setScanProgress(null);
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      const idx = tracks.findIndex((t) => t.path === track.path);
      if (idx < 0) return;
      setCurrentIndex(idx);
      setTrackLoading(true);
      try {
        await api.play(track.path);
        setPlaying(true);
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setTrackLoading(false);
      }
    },
    [tracks],
  );

  const playAtIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      setCurrentIndex(index);
      setTrackLoading(true);
      try {
        await api.playIndex(index);
        setPlaying(true);
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setTrackLoading(false);
      }
    },
    [tracks],
  );

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
    } catch (err) {
      setError(String(err));
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
    } catch (err) {
      setError(String(err));
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
    positionRef.current = pos;
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
    const nextMode: RepeatMode =
      repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    await api.setRepeat(nextMode);
    setRepeatState(nextMode);
  }, [repeat]);

  const setRepeat = useCallback(async (mode: RepeatMode) => {
    await api.setRepeat(mode);
    setRepeatState(mode);
  }, []);

  const search = useCallback(
    async (query: string): Promise<Track[]> => {
      if (!query.trim()) return tracks;
      return api.search(query);
    },
    [tracks],
  );

  const clearError = useCallback(() => setError(null), []);

  // Auto-advance on track end
  useEffect(() => {
    const unlisten = listen(TRACK_ENDED, async () => {
      if (repeat === "one") {
        await api.seek(0);
        positionRef.current = 0;
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

  // Position polling
  useEffect(() => {
    if (playing) {
      positionInterval.current = setInterval(async () => {
        try {
          const state = await api.getState();
          positionRef.current = state.position;
          setPositionValue(state.position);
          setPlaying(state.playing);
          if (state.current_track) {
            const idx = tracks.findIndex(
              (t) => t.path === state.current_track,
            );
            if (idx >= 0) {
              setCurrentIndex(idx);
            }
          } else {
            setCurrentIndex(-1);
          }
        } catch (err) {
          setError(String(err));
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

  const stateValue = useMemo<PlayerState>(
    () => ({
      tracks,
      currentIndex,
      currentTrack,
      playing,
      volume,
      error,
      loading,
      trackLoading,
      scanProgress,
      shuffle,
      repeat,
      positionValue,
      positionRef,
    }),
    [
      tracks,
      currentIndex,
      currentTrack,
      playing,
      volume,
      error,
      loading,
      trackLoading,
      scanProgress,
      shuffle,
      repeat,
      positionValue,
    ],
  );

  const actionsValue = useMemo<PlayerActions>(
    () => ({
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
      clearError,
    }),
    [
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
      clearError,
    ],
  );

  return (
    <PlayerStateContext.Provider value={stateValue}>
      <PlayerActionsContext.Provider value={actionsValue}>
        {children}
      </PlayerActionsContext.Provider>
    </PlayerStateContext.Provider>
  );
}

export function usePlayerState(): PlayerState {
  const ctx = useContext(PlayerStateContext);
  if (!ctx) {
    throw new Error("usePlayerState must be used within PlayerProvider");
  }
  return ctx;
}

export function usePlayerActions(): PlayerActions {
  const ctx = useContext(PlayerActionsContext);
  if (!ctx) {
    throw new Error("usePlayerActions must be used within PlayerProvider");
  }
  return ctx;
}

/**
 * Convenience hook that returns both state and actions. Equivalent to the
 * original usePlaylist() return value so call sites can migrate incrementally.
 */
export function usePlayerStore() {
  return { ...usePlayerState(), ...usePlayerActions() };
}
