import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const state: { currentTrack: Track | null; playing: boolean } = { currentTrack: null, playing: false };
vi.mock("../hooks/usePlayerStore", () => ({ usePlayerState: () => state }));
vi.mock("../lib/api", () => ({
  api: {
    recordPlay: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue([]),
    clearHistory: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "../lib/api";
import { sourceOf, toHistoryEntry, useRecordPlays } from "../hooks/useRecordPlays";
import { HISTORY_CHANGED_EVENT, usePlayHistory } from "../hooks/usePlayHistory";

const local: Track = { path: "C:\\m\\a.mp3", title: "A", artist: "X", album: "Alb", duration: 100 };
const other: Track = { path: "C:\\m\\b.mp3", title: "B", artist: "Y", album: "Alb", duration: 90 };

beforeEach(() => {
  vi.clearAllMocks();
  state.currentTrack = null;
  state.playing = false;
});

describe("sourceOf", () => {
  it.each([
    [{ ...local, path: "youtube:dQw4w9WgXcQ" }, "youtube"],
    [{ ...local, album: "YouTube" }, "youtube"],
    [{ ...local, path: "https://radio.example/stream" }, "radio"],
    [local, "local"],
  ])("classifies %o as %s", (track, expected) => {
    expect(sourceOf(track as Track)).toBe(expected);
  });

  it("builds the entry sent to the backend", () => {
    expect(toHistoryEntry(local, 123)).toEqual({ ...local, source: "local", playedAt: 123 });
  });
});

describe("useRecordPlays", () => {
  it("records one entry when a track starts and ignores pause/resume", () => {
    const { rerender } = renderHook(() => useRecordPlays());
    expect(api.recordPlay).not.toHaveBeenCalled();

    state.currentTrack = local;
    state.playing = true;
    rerender();
    expect(api.recordPlay).toHaveBeenCalledTimes(1);

    state.playing = false;
    rerender();
    state.playing = true;
    rerender();
    expect(api.recordPlay).toHaveBeenCalledTimes(1);
  });

  it("records each new track and the same track again after playback stopped", () => {
    const { rerender } = renderHook(() => useRecordPlays());
    state.currentTrack = local;
    state.playing = true;
    rerender();
    state.currentTrack = other;
    rerender();
    expect(api.recordPlay).toHaveBeenCalledTimes(2);

    state.currentTrack = null;
    state.playing = false;
    rerender();
    state.currentTrack = other;
    state.playing = true;
    rerender();
    expect(api.recordPlay).toHaveBeenCalledTimes(3);
  });

  it("does not record a track that is loaded but not playing", () => {
    state.currentTrack = local;
    renderHook(() => useRecordPlays());
    expect(api.recordPlay).not.toHaveBeenCalled();
  });
});

describe("usePlayHistory", () => {
  it("loads entries, refreshes on the history event and clears", async () => {
    const entries = [{ ...local, source: "local" as const, playedAt: 1 }];
    vi.mocked(api.getHistory).mockResolvedValueOnce(entries);
    const { result } = renderHook(() => usePlayHistory());
    await waitFor(() => expect(result.current.entries).toEqual(entries));
    expect(result.current.loading).toBe(false);

    vi.mocked(api.getHistory).mockResolvedValueOnce([]);
    act(() => { window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT)); });
    await waitFor(() => expect(result.current.entries).toEqual([]));

    await act(async () => { await result.current.clear(); });
    expect(api.clearHistory).toHaveBeenCalledOnce();
  });

  it("survives a backend failure", async () => {
    vi.mocked(api.getHistory).mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => usePlayHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
    spy.mockRestore();
  });
});
