import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMediaSession } from "../hooks/useMediaSession";
import type { Track } from "../types";

const track: Track = {
  path: "/song.mp3",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  duration: 200,
};

const actions = {
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onSeek: vi.fn(),
};

let mockMediaSession: any;

beforeEach(() => {
  mockMediaSession = {
    metadata: null,
    playbackState: "none",
    setActionHandler: vi.fn(),
  };
  Object.defineProperty(navigator, "mediaSession", {
    value: mockMediaSession,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMediaSession", () => {
  it("sets metadata when track provided", () => {
    renderHook(() => useMediaSession(track, false, 0, actions));
    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata.title).toBe("Test Song");
    expect(mockMediaSession.metadata.artist).toBe("Test Artist");
  });

  it("clears metadata when no track", () => {
    mockMediaSession.metadata = { title: "old" };
    renderHook(() => useMediaSession(null, false, 0, actions));
    expect(mockMediaSession.metadata).toBeNull();
  });

  it("sets playbackState to playing", () => {
    renderHook(() => useMediaSession(track, true, 0, actions));
    expect(mockMediaSession.playbackState).toBe("playing");
  });

  it("sets playbackState to paused", () => {
    renderHook(() => useMediaSession(track, false, 0, actions));
    expect(mockMediaSession.playbackState).toBe("paused");
  });

  it("registers action handlers", () => {
    renderHook(() => useMediaSession(track, false, 0, actions));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", actions.onPlay);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", actions.onPause);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("nexttrack", actions.onNext);
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("previoustrack", actions.onPrevious);
  });
});
