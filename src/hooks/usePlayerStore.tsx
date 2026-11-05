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
import { TRACK_ENDED, PLAYBACK_ERROR, OUTPUT_RECOVERED } from "../lib/events";
import type { Track, RepeatMode, RadioStation, CustomPlaylist } from "../types";
import { youtubeIdFromPath, youtubeItemTrack, type YouTubeItem } from "../types/youtube";
import type { YouTubeController } from "./useYouTubePlayer";
import { readAutoplay } from "../lib/autoplay";
import { invoke, isAndroid } from "../lib/platform";

/** Compares local paths regardless of the `\\?\` prefix added by canonicalize. */
function pathKey(path: string): string {
  if (/^(https?|content):\/\//i.test(path)) return path;
  return path.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase();
}

function isYouTubeTrack(track: Track | null): boolean {
  return track !== null && youtubeIdFromPath(track.path) !== null;
}

const YOUTUBE_HOST_MESSAGE = isAndroid
  ? "YouTube solo se reproduce en el modo Normal. Volvé a ese modo para continuar."
  : "YouTube solo se reproduce en el modo Normal o Flow. Volvé a uno de esos modos para continuar.";

/**
 * Player state + actions, exposed via React Context to eliminate the
 * `App → AppLayout → PlayerBar` prop drilling.
 */
export interface PlayerState {
  // Read state
  tracks: Track[];
  queue: Track[];
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
  favorites: string[];
  customRadioStations: RadioStation[];
  customPlaylists: CustomPlaylist[];
}

export interface PlayerActions {
  loadLibrary: (path: string) => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  playAtIndex: (index: number) => Promise<void>;
  playVirtualTrack: (track: Track) => Promise<void>;
  /** Plays a YouTube video through the official embedded player. */
  playYouTube: (item: YouTubeItem, queue?: YouTubeItem[]) => Promise<void>;
  /** The embedded player host registers its controller so transport actions reach the video. */
  registerYouTubeController: (controller: YouTubeController | null) => void;
  reportYouTubeState: (state: { playing?: boolean; position?: number; duration?: number }) => void;
  youtubeEnded: () => void;
  stopYouTube: () => void;
  playCollection: (tracks: Track[], index: number) => Promise<void>;
  playExternalFile: (path: string) => Promise<void>;
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
  toggleFavorite: (trackPath: string) => Promise<void>;
  addCustomRadio: (station: RadioStation) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  addTrackToPlaylist: (playlistName: string, trackPath: string) => Promise<void>;
}

const PlayerStateContext = createContext<PlayerState | null>(null);
const PlayerActionsContext = createContext<PlayerActions | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const queueRef = useRef<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customRadioStations, setCustomRadioStations] = useState<RadioStation[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<CustomPlaylist[]>([]);

  useEffect(() => {
    api.getConfig().then((c) => {
      setFavorites(c.favorites || []);
      setCustomRadioStations(c.custom_radio_stations || []);
      setCustomPlaylists(c.custom_playlists || []);
    }).catch(console.error);
  }, []);
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
  const optimisticPlaying = useRef(false);
  const seekingRef = useRef(false);
  const flickerCount = useRef(0);
  const ytControllerRef = useRef<YouTubeController | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;

  const loadLibrary = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setScanProgress(null);
    try {
      const result = await api.scanFolder(path, (p) => {
        setScanProgress({ processed: p.processed, found: p.found });
      }, (warnings) => {
        setError(`Se omitieron ${warnings.length} archivos de audio. ${warnings.slice(0, 3).join(". ")}${warnings.length > 3 ? "." : ""}`);
      });
      setTracks(result);
      setCurrentIndex(-1);
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
      setCurrentTrack(track);
      positionRef.current = 0;
      setPositionValue(0);
      setTrackLoading(true);
      optimisticPlaying.current = true;
      try {
        await api.setPlaylist(tracks, idx);
        queueRef.current = tracks;
        setQueue(tracks);
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
      setCurrentTrack(tracks[index]);
      positionRef.current = 0;
      setPositionValue(0);
      setTrackLoading(true);
      optimisticPlaying.current = true;
      try {
        await api.setPlaylist(tracks, index);
        queueRef.current = tracks;
        setQueue(tracks);
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

  const playCollection = useCallback(async (collection: Track[], index: number) => {
    if (!collection[index]) {
      setError("No se pudo reproducir: la lista no contiene esa canción.");
      return;
    }
    setTrackLoading(true);
    try {
      await api.setPlaylist(collection, index);
      queueRef.current = collection;
      setQueue(collection);
      setCurrentTrack(collection[index]);
      setCurrentIndex(tracks.findIndex((t) => pathKey(t.path) === pathKey(collection[index].path)));
      positionRef.current = 0;
      setPositionValue(0);
      optimisticPlaying.current = true;
      setPlaying(true);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks]);

  const playVirtualTrack = useCallback(
    async (track: Track) => {
      setTrackLoading(true);
      setError(null);
      positionRef.current = 0;
      setPositionValue(0);
      optimisticPlaying.current = true;
      try {
        if (/^https?:\/\//i.test(track.path)) {
          await api.playUrl(track.path);
        } else {
          await api.setPlaylist([track], 0);
        }
        queueRef.current = [track];
        setQueue([track]);
        setPlaying(true);
        setCurrentIndex(-1);
        setCurrentTrack(track);
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setTrackLoading(false);
      }
    },
    [],
  );

  const playYouTube = useCallback(async (item: YouTubeItem, queueItems?: YouTubeItem[]) => {
    const list = (queueItems?.length ? queueItems : [item]).map(youtubeItemTrack);
    setError(null);
    try {
      if (isAndroid) await invoke<void>("prepare_youtube");
      else await api.pause();
    } catch (reason) {
      setError(`No se pudo detener el audio anterior: ${String(reason)}`);
      throw reason;
    }
    queueRef.current = list;
    setQueue(list);
    setCurrentIndex(-1);
    setCurrentTrack(youtubeItemTrack(item));
    positionRef.current = 0;
    setPositionValue(0);
    optimisticPlaying.current = true;
    setPlaying(true);
  }, []);

  const registerYouTubeController = useCallback((controller: YouTubeController | null) => {
    ytControllerRef.current = controller;
  }, []);

  // The official player only exists in Normal and Flow; Zen and Mini unmount it, so nothing can play there.
  const youtubeNeedsHost = useCallback((): boolean => {
    if (!isYouTubeTrack(currentTrackRef.current) || ytControllerRef.current) return false;
    setError(YOUTUBE_HOST_MESSAGE);
    return true;
  }, []);

  const stepYouTube = useCallback((direction: 1 | -1): boolean => {
    const list = queueRef.current;
    const index = list.findIndex((track) => track.path === currentTrackRef.current?.path);
    const target = list[index + direction];
    if (!target) return false;
    positionRef.current = 0;
    setPositionValue(0);
    const canPlay = ytControllerRef.current !== null;
    optimisticPlaying.current = canPlay;
    setCurrentTrack(target);
    setPlaying(canPlay);
    if (!canPlay) setError(YOUTUBE_HOST_MESSAGE);
    return true;
  }, []);

  const reportYouTubeState = useCallback((state: { playing?: boolean; position?: number; duration?: number }) => {
    if (!isYouTubeTrack(currentTrackRef.current)) return;
    if (state.playing !== undefined) {
      optimisticPlaying.current = state.playing;
      setPlaying(state.playing);
    }
    if (state.position !== undefined && Number.isFinite(state.position)) {
      positionRef.current = state.position;
      setPositionValue(state.position);
    }
    const duration = state.duration;
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
      setCurrentTrack((previous) =>
        previous && isYouTubeTrack(previous) && previous.duration <= 0
          ? { ...previous, duration: Math.floor(duration) }
          : previous,
      );
    }
  }, []);

  const youtubeEnded = useCallback(() => {
    if (!isYouTubeTrack(currentTrackRef.current)) return;
    if (repeatRef.current === "one") {
      ytControllerRef.current?.seek(0);
      ytControllerRef.current?.play();
      return;
    }
    if (readAutoplay() && stepYouTube(1)) return;
    const list = queueRef.current;
    if (repeatRef.current === "all" && list.length > 1) {
      positionRef.current = 0;
      setPositionValue(0);
      setCurrentTrack(list[0]);
      setPlaying(true);
      return;
    }
    optimisticPlaying.current = false;
    setPlaying(false);
  }, [stepYouTube]);

  const stopYouTube = useCallback(() => {
    ytControllerRef.current?.stop();
    optimisticPlaying.current = false;
    setPlaying(false);
    setCurrentIndex(-1);
    setCurrentTrack(null);
  }, []);

  const playExternalFile = useCallback(async (path: string) => {
    let track: Track = {
      path,
      title: path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? path,
      artist: "Unknown",
      album: "",
      duration: 0,
    };
    setTrackLoading(true);
    positionRef.current = 0;
    setPositionValue(0);
    optimisticPlaying.current = true;
    try {
      try {
        track = { ...(await api.getTrackInfo(path)), path };
      } catch {
        // Metadata is optional; keep the file-name fallback.
      }
      await api.setPlaylist([track], 0);
      queueRef.current = [track];
      setQueue([track]);
      setPlaying(true);
      setCurrentIndex(-1);
      setCurrentTrack(track);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setTrackLoading(false);
    }
  }, []);

  const pause = useCallback(async () => {
    optimisticPlaying.current = false;
    setPlaying(false);
    if (isYouTubeTrack(currentTrackRef.current)) {
      ytControllerRef.current?.pause();
      return;
    }
    await api.pause().catch(() => {});
  }, []);

  const resume = useCallback(async () => {
    if (youtubeNeedsHost()) return;
    optimisticPlaying.current = true;
    setPlaying(true);
    if (isYouTubeTrack(currentTrackRef.current)) {
      ytControllerRef.current?.play();
      return;
    }
    await api.resume().catch(() => {});
  }, [youtubeNeedsHost]);

  const toggle = useCallback(async () => {
    if (playing) {
      await pause();
    } else {
      await resume();
    }
  }, [playing, pause, resume]);

  const next = useCallback(async () => {
    if (isYouTubeTrack(currentTrackRef.current)) {
      if (!stepYouTube(1)) {
        ytControllerRef.current?.pause();
        optimisticPlaying.current = false;
        setPlaying(false);
      }
      return;
    }
    setTrackLoading(true);
    positionRef.current = 0;
    setPositionValue(0);
    optimisticPlaying.current = true;
    try {
      const track = await api.next();
      if (track) {
        const idx = tracks.findIndex((t) => pathKey(t.path) === pathKey(track.path));
        setCurrentIndex(idx);
        setCurrentTrack(track);
        setPlaying(true);
        setError(null);
      } else {
        optimisticPlaying.current = false;
        setPlaying(false);
        setCurrentIndex(-1);
        setCurrentTrack(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks, stepYouTube]);

  const previous = useCallback(async () => {
    if (isYouTubeTrack(currentTrackRef.current)) {
      if (positionRef.current > 3 || !stepYouTube(-1)) {
        positionRef.current = 0;
        setPositionValue(0);
        ytControllerRef.current?.seek(0);
      }
      return;
    }
    setTrackLoading(true);
    positionRef.current = 0;
    setPositionValue(0);
    optimisticPlaying.current = true;
    try {
      const track = await api.previous();
      if (track) {
        const idx = tracks.findIndex((t) => pathKey(t.path) === pathKey(track.path));
        setCurrentIndex(idx);
        setCurrentTrack(track);
        setPlaying(true);
        setError(null);
      } else {
        optimisticPlaying.current = false;
        setPlaying(false);
        setCurrentIndex(-1);
        setCurrentTrack(null);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setTrackLoading(false);
    }
  }, [tracks, stepYouTube]);

  const setVolume = useCallback(async (v: number) => {
    ytControllerRef.current?.setVolume(v);
    if (isYouTubeTrack(currentTrackRef.current)) {
      setVolumeState(v);
      await api.setVolume(v).catch(() => {});
      return;
    }
    await api.setVolume(v);
    setVolumeState(v);
  }, []);

  const seek = useCallback(async (pos: number) => {
    seekingRef.current = true;
    positionRef.current = pos;
    setPositionValue(pos);
    if (isYouTubeTrack(currentTrackRef.current)) {
      ytControllerRef.current?.seek(pos);
    } else {
      await api.seek(pos).catch(() => {});
    }
    setTimeout(() => { seekingRef.current = false; }, 600);
  }, []);

  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;

  const toggleShuffle = useCallback(async () => {
    const next = !shuffleRef.current;
    await api.setShuffle(next).catch(() => {});
    setShuffleState(next);
  }, []);

  const setShuffle = useCallback(async (on: boolean) => {
    setShuffleState(on);
    await api.setShuffle(on).catch(() => {});
  }, []);

  const cycleRepeat = useCallback(async () => {
    const nextMode: RepeatMode =
      repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    setRepeatState(nextMode);
    await api.setRepeat(nextMode).catch(() => {});
  }, [repeat]);

  const setRepeat = useCallback(async (mode: RepeatMode) => {
    setRepeatState(mode);
    await api.setRepeat(mode).catch(() => {});
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
  const nextRef = useRef(next);
  nextRef.current = next;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;

  useEffect(() => {
    const unlisten = listen(TRACK_ENDED, async () => {
      try {
        if (repeatRef.current === "one") {
          const state = await api.getState();
          const track = queueRef.current.find((t) => pathKey(t.path) === pathKey(state.current_track ?? ""));
          if (track) {
            if (/^https?:\/\//i.test(track.path)) await api.playUrl(track.path);
            else await api.setPlaylist(queueRef.current, queueRef.current.indexOf(track));
            positionRef.current = 0;
            setPositionValue(0);
            setPlaying(true);
          }
        } else {
          await nextRef.current();
        }
      } catch (err) {
        setError(String(err));
        setPlaying(false);
        optimisticPlaying.current = false;
      }
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  // Playback error listener
  useEffect(() => {
    const unlisten = listen<string>(PLAYBACK_ERROR, (e) => {
      setError(e.payload);
    });
    const recovered = listen(OUTPUT_RECOVERED, () => {
      setError((previous) => previous?.startsWith("Audio output lost:") ? null : previous);
    });
    return () => {
      unlisten.then((u) => u());
      recovered.then((u) => u());
    };
  }, []);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    if ((isAndroid || playing || currentTrack) && !isYouTubeTrack(currentTrack)) {
      positionInterval.current = setInterval(async () => {
        try {
          const state = await api.getState();
          const currentTracks = tracksRef.current;
          if (!seekingRef.current) {
            const position = state.duration > 0 ? Math.min(state.position, state.duration) : state.position;
            positionRef.current = position;
            setPositionValue(position);
          }
          if (optimisticPlaying.current !== state.playing) {
            flickerCount.current++;
            if (flickerCount.current >= 2) {
              setPlaying(state.playing);
              optimisticPlaying.current = state.playing;
            }
          } else {
            flickerCount.current = 0;
          }
          if (state.current_track) {
            const currentPath = state.current_track;
            const currentKey = pathKey(currentPath);
            const idx = currentTracks.findIndex(
              (t) => pathKey(t.path) === currentKey,
            );
            if (idx >= 0) {
              setCurrentIndex(idx);
              setCurrentTrack(currentTracks[idx]);
            } else {
              setCurrentIndex(-1);
              setCurrentTrack((prev) => {
                const queued = queueRef.current.find((t) => pathKey(t.path) === currentKey);
                if (queued) return queued;
                if (prev && pathKey(prev.path) === currentKey) {
                  return prev;
                }
                const isUrl = /^https?:\/\//i.test(currentPath);
                const isYt = currentPath.includes("googlevideo.com") || currentPath.includes("youtube.com") || currentPath.includes("youtu.be");
                if (!isUrl) {
                  return {
                    path: currentPath,
                    title: currentPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? currentPath,
                    artist: "Unknown",
                    album: "",
                    duration: state.duration || 0,
                  };
                }
                return {
                  path: currentPath,
                  title: isYt ? "YouTube Video" : "Radio Stream",
                  artist: isYt ? "YouTube" : "Radio",
                  album: isYt ? "YouTube" : "Internet Radio",
                  duration: state.duration || 0,
                };
              });
            }
          } else {
            setCurrentIndex(-1);
            setCurrentTrack(null);
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
  }, [playing, currentTrack?.path]);

  useEffect(() => {
    if (currentTrack) {
      api.updateSmtcMetadata(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        currentTrack.duration,
      ).catch(console.error);
    }
  }, [currentTrack]);

  const toggleFavorite = useCallback(async (trackPath: string) => {
    const config = await api.getConfig();
    const nextFavorites = favorites.includes(trackPath)
      ? favorites.filter((p) => p !== trackPath)
      : [...favorites, trackPath];
    setFavorites(nextFavorites);
    try {
      await api.setConfig({ ...config, favorites: nextFavorites });
    } catch (err) {
      setError(`Failed to toggle favorite: ${err}`);
      setFavorites(favorites); // revert
    }
  }, [favorites]);

  const addCustomRadio = useCallback(async (station: RadioStation) => {
    const config = await api.getConfig();
    if (customRadioStations.some((r) => r.url === station.url)) return;
    const nextRadios = [...customRadioStations, station];
    setCustomRadioStations(nextRadios);
    try {
      await api.setConfig({ ...config, custom_radio_stations: nextRadios });
    } catch (err) {
      setError(`Failed to add custom radio: ${err}`);
      setCustomRadioStations(customRadioStations); // revert
    }
  }, [customRadioStations]);

  const createPlaylist = useCallback(async (name: string) => {
    const config = await api.getConfig();
    if (customPlaylists.some((p) => p.name === name)) return;
    const nextPlaylists = [...customPlaylists, { name, tracks: [] }];
    setCustomPlaylists(nextPlaylists);
    try {
      await api.setConfig({ ...config, custom_playlists: nextPlaylists });
    } catch (err) {
      setError(`Failed to create playlist: ${err}`);
      setCustomPlaylists(customPlaylists); // revert
    }
  }, [customPlaylists]);

  const addTrackToPlaylist = useCallback(async (playlistName: string, trackPath: string) => {
    const config = await api.getConfig();
    const nextPlaylists = customPlaylists.map((pl) => {
      if (pl.name === playlistName && !pl.tracks.includes(trackPath)) {
        return { ...pl, tracks: [...pl.tracks, trackPath] };
      }
      return pl;
    });
    setCustomPlaylists(nextPlaylists);
    try {
      await api.setConfig({ ...config, custom_playlists: nextPlaylists });
    } catch (err) {
      setError(`Failed to add track to playlist: ${err}`);
      setCustomPlaylists(customPlaylists); // revert
    }
  }, [customPlaylists]);

  const stateValue = useMemo<PlayerState>(
    () => ({
      tracks,
      queue,
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
      favorites,
      customRadioStations,
      customPlaylists,
    }),
    [
      tracks,
      queue,
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
      favorites,
      customRadioStations,
      customPlaylists,
    ],
  );

  const actionsValue = useMemo<PlayerActions>(
    () => ({
      loadLibrary,
      playTrack,
      playAtIndex,
      playVirtualTrack,
      playYouTube,
      registerYouTubeController,
      reportYouTubeState,
      youtubeEnded,
      stopYouTube,
      playCollection,
      playExternalFile,
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
      toggleFavorite,
      addCustomRadio,
      createPlaylist,
      addTrackToPlaylist,
    }),
    [
      loadLibrary,
      playTrack,
      playAtIndex,
      playVirtualTrack,
      playYouTube,
      registerYouTubeController,
      reportYouTubeState,
      youtubeEnded,
      stopYouTube,
      playCollection,
      playExternalFile,
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
      toggleFavorite,
      addCustomRadio,
      createPlaylist,
      addTrackToPlaylist,
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

export const usePlaylist = usePlayerStore;
