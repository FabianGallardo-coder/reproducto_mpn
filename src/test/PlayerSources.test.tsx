import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerProvider, usePlayerStore } from "../hooks/usePlayerStore";
import { api } from "../lib/api";
import { listen } from "@tauri-apps/api/event";
import { TRACK_ENDED } from "../lib/events";
import type { Track } from "../types";
vi.mock("../lib/api", () => ({ api: {
  getConfig: vi.fn().mockResolvedValue({ favorites: [], custom_playlists: [], custom_radio_stations: [] }),
  scanFolder: vi.fn(), setPlaylist: vi.fn(), next: vi.fn(), previous: vi.fn(), setRepeat: vi.fn().mockResolvedValue(undefined),
  updateSmtcMetadata: vi.fn().mockResolvedValue(undefined), getState: vi.fn(),
} }));
const folder: Track = { path: "C:\\folder\\one.mp3", title: "Folder track", artist: "Author", album: "Folder", duration: 60 };
const external: Track = { path: "C:\\downloads\\one.m4a", title: "Download", artist: "Artist", album: "YouTube", duration: 30 };
let player: ReturnType<typeof usePlayerStore>;
function Probe() { player = usePlayerStore(); return null; }
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.scanFolder).mockResolvedValue([folder]);
  vi.mocked(api.setPlaylist).mockResolvedValue(undefined);
  vi.mocked(api.getState).mockResolvedValue({ playing: true, position: 0, duration: 30, volume: 0.8, current_track: external.path });
});
describe("Player source queues", () => {
  it("activates a collection without replacing the visible folder library", async () => {
    render(<PlayerProvider><Probe /></PlayerProvider>);
    await act(async () => { await player.loadLibrary("C:\\folder"); });
    await act(async () => { await player.playCollection([external, folder], 0); });
    expect(api.setPlaylist).toHaveBeenLastCalledWith([external, folder], 0);
    expect(player.tracks).toEqual([folder]);
    expect(player.queue).toEqual([external, folder]);
    expect(player.currentTrack).toEqual(external);
    expect(player.currentIndex).toBe(-1);
    vi.mocked(api.next).mockResolvedValue(folder);
    await act(async () => { await player.next(); });
    expect(player.currentIndex).toBe(0);
    vi.mocked(api.previous).mockResolvedValue(external);
    await act(async () => { await player.previous(); });
    expect(player.currentIndex).toBe(-1);
    expect(player.currentTrack).toEqual(external);
  });
  it("does not interrupt the active collection when a new folder is scanned", async () => {
    render(<PlayerProvider><Probe /></PlayerProvider>);
    await act(async () => { await player.playCollection([external], 0); });
    await act(async () => { await player.loadLibrary("C:\\folder"); });
    expect(player.playing).toBe(true);
    expect(player.currentTrack).toEqual(external);
    expect(player.queue).toEqual([external]);
    expect(player.tracks).toEqual([folder]);
    expect(api.setPlaylist).toHaveBeenCalledOnce();
  });
  it("reports an invalid selection without sending an empty queue", async () => {
    render(<PlayerProvider><Probe /></PlayerProvider>);
    await act(async () => { await player.playCollection([], 0); });
    await waitFor(() => expect(player.error).toContain("no contiene esa canción"));
    expect(api.setPlaylist).not.toHaveBeenCalled();
  });
  it("reports a repeat-one restart failure without leaving playback marked active", async () => {
    render(<PlayerProvider><Probe /></PlayerProvider>);
    await act(async () => { await player.playCollection([external], 0); await player.setRepeat("one"); });
    vi.mocked(api.setPlaylist).mockRejectedValueOnce(new Error("Audio file unavailable"));
    const ended = vi.mocked(listen).mock.calls.find(([event]) => event === TRACK_ENDED)?.[1];
    expect(ended).toBeDefined();
    await act(async () => { await ended!({ event: TRACK_ENDED, id: 0, payload: undefined }); });
    expect(player.error).toContain("Audio file unavailable");
    expect(player.playing).toBe(false);
    expect(player.queue).toEqual([external]);
  });
});
