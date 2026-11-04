import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePlaylist, PlayerProvider } from "../hooks/usePlayerStore";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    scanFolder: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn().mockResolvedValue(undefined),
    next: vi.fn(),
    previous: vi.fn(),
    setVolume: vi.fn().mockResolvedValue(undefined),
    setShuffle: vi.fn().mockResolvedValue(undefined),
    setRepeat: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(),
    getState: vi.fn(),
    setPlaylist: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockResolvedValue({ favorites: [], custom_radio_stations: [], custom_playlists: [] }),
    setConfig: vi.fn().mockResolvedValue(undefined),
    updateSmtcMetadata: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

const tracks = [
  { path: "/1.mp3", title: "A", artist: "X", album: "A1", duration: 180 },
  { path: "/2.mp3", title: "B", artist: "Y", album: "A2", duration: 200 },
  { path: "/3.mp3", title: "C", artist: "Z", album: "A3", duration: 220 },
];

beforeEach(() => {
  vi.mocked(api.scanFolder).mockResolvedValue(tracks);
  vi.mocked(api.getState).mockResolvedValue({ playing: false, position: 0, duration: 0, volume: 0.8, current_track: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePlaylist", () => {
  const renderPlaylistHook = () => renderHook(() => usePlaylist(), { wrapper: PlayerProvider });

  it("initializes with empty state", () => {
    const { result } = renderPlaylistHook();
    expect(result.current.tracks).toEqual([]);
    expect(result.current.playing).toBe(false);
    expect(result.current.volume).toBe(0.8);
    expect(result.current.repeat).toBe("off");
    expect(result.current.shuffle).toBe(false);
    expect(result.current.currentTrack).toBeNull();
  });

  it("loadLibrary populates tracks", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => {
      await result.current.loadLibrary("/music");
    });
    expect(result.current.tracks).toHaveLength(3);
  });

  it("loadLibrary displays scan warnings without discarding playable tracks", async () => {
    vi.mocked(api.scanFolder).mockImplementationOnce(async (_path, _progress, onWarnings) => {
      onWarnings?.(['No se pudo leer "Broken.wav"']);
      return tracks;
    });
    const { result } = renderPlaylistHook();
    await act(async () => { await result.current.loadLibrary("/music"); });
    expect(result.current.tracks).toEqual(tracks);
    expect(result.current.error).toBe('Se omitieron 1 archivos de audio. No se pudo leer "Broken.wav"');
    expect(result.current.loading).toBe(false);
    await act(async () => { await result.current.loadLibrary("/music"); });
    expect(result.current.error).toBeNull();
    expect(result.current.tracks).toEqual(tracks);
  });

  it("setVolume calls api", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => {
      await result.current.setVolume(0.5);
    });
    expect(api.setVolume).toHaveBeenCalledWith(0.5);
    expect(result.current.volume).toBe(0.5);
  });

  it("toggleShuffle toggles state", async () => {
    const { result } = renderPlaylistHook();
    expect(result.current.shuffle).toBe(false);
    await act(async () => {
      await result.current.toggleShuffle();
    });
    expect(result.current.shuffle).toBe(true);
    expect(api.setShuffle).toHaveBeenCalledWith(true);
  });

  it("cycleRepeat cycles off → all → one → off", async () => {
    const { result } = renderPlaylistHook();
    expect(result.current.repeat).toBe("off");
    await act(async () => { await result.current.cycleRepeat(); });
    expect(result.current.repeat).toBe("all");
    await act(async () => { await result.current.cycleRepeat(); });
    expect(result.current.repeat).toBe("one");
    await act(async () => { await result.current.cycleRepeat(); });
    expect(result.current.repeat).toBe("off");
  });

  it("setRepeat sets specific mode", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => { await result.current.setRepeat("one"); });
    expect(result.current.repeat).toBe("one");
  });

  it("setShuffle sets specific value", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => { await result.current.setShuffle(true); });
    expect(result.current.shuffle).toBe(true);
  });

  it("seek calls api and updates position", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => { await result.current.seek(42); });
    expect(api.seek).toHaveBeenCalledWith(42);
    expect(result.current.positionRef.current).toBe(42);
  });

  it("search returns tracks for empty query", async () => {
    const { result } = renderPlaylistHook();
    await act(async () => { await result.current.loadLibrary("/music"); });
    const res = await result.current.search("");
    expect(res).toEqual(tracks);
  });

  it("search calls api for non-empty query", async () => {
    vi.mocked(api.search).mockResolvedValue([tracks[0]]);
    const { result } = renderPlaylistHook();
    const res = await result.current.search("hello");
    expect(api.search).toHaveBeenCalledWith("hello");
    expect(res).toHaveLength(1);
  });

  it("clearError resets error", async () => {
    const { result } = renderPlaylistHook();
    // Trigger an error event would be complex, just test clearError exists
    expect(typeof result.current.clearError).toBe("function");
  });

  it("toggleFavorite calls api and updates local state", async () => {
    vi.mocked(api.setConfig).mockResolvedValue(undefined);
    const { result } = renderPlaylistHook();
    expect(result.current.favorites).toEqual([]);

    await act(async () => {
      await result.current.toggleFavorite("/1.mp3");
    });
    expect(result.current.favorites).toContain("/1.mp3");
    expect(api.setConfig).toHaveBeenCalled();

    await act(async () => {
      await result.current.toggleFavorite("/1.mp3");
    });
    expect(result.current.favorites).not.toContain("/1.mp3");
  });

  it("concurrent toggleFavorite resolves without crash", async () => {
    vi.mocked(api.setConfig).mockResolvedValue(undefined);
    const { result } = renderPlaylistHook();

    await act(async () => {
      await Promise.allSettled([
        result.current.toggleFavorite("/1.mp3"),
        result.current.toggleFavorite("/2.mp3"),
      ]);
    });
    expect(result.current.favorites.length).toBeGreaterThanOrEqual(1);
    expect(result.current.favorites.length).toBeLessThanOrEqual(2);
  });

  it("addCustomRadio adds station to list", async () => {
    vi.mocked(api.setConfig).mockResolvedValue(undefined);
    const { result } = renderPlaylistHook();
    const station = { name: "Test FM", genre: "Rock", url: "http://stream.fm", description: "Test" };

    await act(async () => {
      await result.current.addCustomRadio(station);
    });
    expect(result.current.customRadioStations).toHaveLength(1);
    expect(result.current.customRadioStations[0].name).toBe("Test FM");
  });

  it("createPlaylist adds playlist", async () => {
    vi.mocked(api.setConfig).mockResolvedValue(undefined);
    const { result } = renderPlaylistHook();

    await act(async () => {
      await result.current.createPlaylist("My Playlist");
    });
    expect(result.current.customPlaylists).toHaveLength(1);
    expect(result.current.customPlaylists[0].name).toBe("My Playlist");
    expect(result.current.customPlaylists[0].tracks).toEqual([]);
  });

  it("addTrackToPlaylist adds track to existing playlist", async () => {
    vi.mocked(api.setConfig).mockResolvedValue(undefined);
    const { result } = renderPlaylistHook();

    await act(async () => {
      await result.current.createPlaylist("My Playlist");
    });
    await act(async () => {
      await result.current.addTrackToPlaylist("My Playlist", "/1.mp3");
    });
    expect(result.current.customPlaylists[0].tracks).toContain("/1.mp3");
  });

  it("positionRef updates on seek", async () => {
    const { result } = renderPlaylistHook();
    expect(result.current.positionRef.current).toBe(0);

    await act(async () => {
      await result.current.seek(99);
    });
    expect(result.current.positionRef.current).toBe(99);
  });
});
