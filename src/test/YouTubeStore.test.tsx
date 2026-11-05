import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerProvider, usePlayerStore } from "../hooks/usePlayerStore";
import { api } from "../lib/api";
import { writeAutoplay } from "../lib/autoplay";
import type { YouTubeController } from "../hooks/useYouTubePlayer";
import type { Track } from "../types";
import type { YouTubeItem } from "../types/youtube";

vi.mock("../lib/api", () => ({ api: {
  getConfig: vi.fn().mockResolvedValue({ favorites: [], custom_playlists: [], custom_radio_stations: [] }),
  scanFolder: vi.fn(), setPlaylist: vi.fn().mockResolvedValue(undefined), next: vi.fn(), previous: vi.fn(),
  pause: vi.fn().mockResolvedValue(undefined), resume: vi.fn().mockResolvedValue(undefined),
  seek: vi.fn().mockResolvedValue(undefined), setVolume: vi.fn().mockResolvedValue(undefined),
  setRepeat: vi.fn().mockResolvedValue(undefined), updateSmtcMetadata: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn(),
} }));

const first: YouTubeItem = { id: "dQw4w9WgXcQ", title: "First", artist: "Channel", duration: 200, available: true };
const second: YouTubeItem = { id: "9bZkp7q19f0", title: "Second", artist: "Channel", duration: 180, available: true };
const local: Track = { path: "C:\\music\\song.mp3", title: "Local", artist: "Author", album: "Album", duration: 60 };

let player: ReturnType<typeof usePlayerStore>;
function Probe() { player = usePlayerStore(); return null; }

function makeController(): YouTubeController {
  return { play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(), setVolume: vi.fn() };
}

async function start(queue: YouTubeItem[] = [first, second]) {
  const controller = makeController();
  render(<PlayerProvider><Probe /></PlayerProvider>);
  act(() => player.registerYouTubeController(controller));
  await act(async () => { await player.playYouTube(first, queue); });
  return controller;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(api.getState).mockResolvedValue({ playing: false, position: 0, duration: 0, volume: 0.8, current_track: null });
});

describe("YouTube playback in the player store", () => {
  it("starts a video, stops the native engine and exposes the queue", async () => {
    await start();
    expect(api.pause).toHaveBeenCalled();
    expect(player.currentTrack).toMatchObject({ path: "youtube:dQw4w9WgXcQ", title: "First", album: "YouTube" });
    expect(player.queue.map((track) => track.path)).toEqual(["youtube:dQw4w9WgXcQ", "youtube:9bZkp7q19f0"]);
    expect(player.playing).toBe(true);
  });

  it("keeps the video as current track while the native state poll runs", async () => {
    vi.useFakeTimers();
    try {
      await start();
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(api.getState).not.toHaveBeenCalled();
      expect(player.currentTrack?.path).toBe("youtube:dQw4w9WgXcQ");
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes pause, resume, seek and volume to the embedded player", async () => {
    const controller = await start();
    await act(async () => { await player.pause(); });
    expect(controller.pause).toHaveBeenCalledOnce();
    expect(api.pause).toHaveBeenCalledTimes(1);
    expect(player.playing).toBe(false);
    await act(async () => { await player.resume(); });
    expect(controller.play).toHaveBeenCalledOnce();
    expect(api.resume).not.toHaveBeenCalled();
    await act(async () => { await player.seek(42); });
    expect(controller.seek).toHaveBeenCalledWith(42);
    expect(api.seek).not.toHaveBeenCalled();
    await act(async () => { await player.setVolume(0.3); });
    expect(controller.setVolume).toHaveBeenCalledWith(0.3);
    expect(player.volume).toBe(0.3);
  });

  it("moves through the YouTube queue with next and previous", async () => {
    const controller = await start();
    await act(async () => { await player.next(); });
    expect(player.currentTrack?.path).toBe("youtube:9bZkp7q19f0");
    expect(api.next).not.toHaveBeenCalled();
    await act(async () => { await player.previous(); });
    expect(player.currentTrack?.path).toBe("youtube:dQw4w9WgXcQ");
    act(() => player.reportYouTubeState({ position: 30 }));
    await act(async () => { await player.previous(); });
    expect(controller.seek).toHaveBeenCalledWith(0);
    expect(player.currentTrack?.path).toBe("youtube:dQw4w9WgXcQ");
  });

  it("pauses at the end of the queue when next has nowhere to go", async () => {
    const controller = await start([first]);
    await act(async () => { await player.next(); });
    expect(controller.pause).toHaveBeenCalled();
    expect(player.playing).toBe(false);
  });

  it("does not claim to play when Zen or Mini unmounted the embedded player", async () => {
    await start();
    act(() => player.registerYouTubeController(null));
    await act(async () => { await player.pause(); });
    await act(async () => { await player.resume(); });
    expect(player.playing).toBe(false);
    expect(player.error).toMatch(/modo Normal o Flow/);
    expect(api.resume).not.toHaveBeenCalled();
  });

  it("moves to the next video without starting playback while the player is unmounted", async () => {
    await start();
    act(() => player.registerYouTubeController(null));
    await act(async () => { await player.next(); });
    expect(player.currentTrack?.path).toBe("youtube:9bZkp7q19f0");
    expect(player.playing).toBe(false);
    expect(player.error).toMatch(/modo Normal o Flow/);
  });

  it("advances on ENDED only while autoplay is on", async () => {
    await start();
    act(() => player.youtubeEnded());
    expect(player.currentTrack?.path).toBe("youtube:9bZkp7q19f0");

    act(() => writeAutoplay(false));
    await act(async () => { await player.playYouTube(first, [first, second]); });
    act(() => player.youtubeEnded());
    expect(player.currentTrack?.path).toBe("youtube:dQw4w9WgXcQ");
    expect(player.playing).toBe(false);
  });

  it("restarts the same video on ENDED when repeat is one", async () => {
    const controller = await start();
    await act(async () => { await player.setRepeat("one"); });
    act(() => player.youtubeEnded());
    expect(controller.seek).toHaveBeenCalledWith(0);
    expect(controller.play).toHaveBeenCalled();
    expect(player.currentTrack?.path).toBe("youtube:dQw4w9WgXcQ");
  });

  it("mirrors player events: state, position and a missing duration", async () => {
    const unknown = { ...first, duration: 0 };
    render(<PlayerProvider><Probe /></PlayerProvider>);
    await act(async () => { await player.playYouTube(unknown, [unknown]); });
    act(() => player.reportYouTubeState({ playing: false, position: 12.5, duration: 199.7 }));
    expect(player.playing).toBe(false);
    expect(player.positionValue).toBe(12.5);
    expect(player.currentTrack?.duration).toBe(199);
  });

  it("stops a local engine takeover: playing a local collection replaces the video", async () => {
    await start();
    await act(async () => { await player.playCollection([local], 0); });
    expect(player.currentTrack).toEqual(local);
    expect(api.setPlaylist).toHaveBeenCalledWith([local], 0);
  });

  it("stopYouTube clears the current video", async () => {
    const controller = await start();
    act(() => player.stopYouTube());
    expect(controller.stop).toHaveBeenCalledOnce();
    expect(player.currentTrack).toBeNull();
    expect(player.playing).toBe(false);
  });
});
