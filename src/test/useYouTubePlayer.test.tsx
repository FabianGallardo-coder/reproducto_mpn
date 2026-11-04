import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadYouTubeApi, resetYouTubeApiForTests, describeYouTubeError, YOUTUBE_API_SRC } from "../lib/youtubeIframeApi";
import { useYouTubePlayer, type YouTubePlayerOptions } from "../hooks/useYouTubePlayer";

interface FakePlayer {
  options: { videoId: string; playerVars: Record<string, number | string>; host: string; events: Record<string, (event: { target: FakePlayer; data: number }) => void> };
  playVideo: ReturnType<typeof vi.fn>;
  pauseVideo: ReturnType<typeof vi.fn>;
  stopVideo: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  loadVideoById: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getCurrentTime: () => number;
  getDuration: () => number;
}

let players: FakePlayer[] = [];

function installFakeYT() {
  const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };
  class Player {
    options: FakePlayer["options"];
    playVideo = vi.fn();
    pauseVideo = vi.fn();
    stopVideo = vi.fn();
    seekTo = vi.fn();
    setVolume = vi.fn();
    loadVideoById = vi.fn();
    destroy = vi.fn();
    getCurrentTime = () => 12;
    getDuration = () => 200;
    constructor(_element: HTMLElement, options: FakePlayer["options"]) {
      this.options = options;
      players.push(this as unknown as FakePlayer);
    }
  }
  window.YT = { Player, PlayerState } as unknown as typeof window.YT;
}

function options(overrides: Partial<YouTubePlayerOptions> = {}): YouTubePlayerOptions {
  return {
    videoId: "dQw4w9WgXcQ", autoplay: true, startSeconds: 0, volume: 0.5,
    onPlaying: vi.fn(), onProgress: vi.fn(), onEnded: vi.fn(), onError: vi.fn(), ...overrides,
  };
}

function Harness({ opts }: { opts: YouTubePlayerOptions }) {
  const { mountRef, status } = useYouTubePlayer(opts);
  return <div><div ref={mountRef} data-testid="mount" /><span data-testid="status">{status}</span></div>;
}

beforeEach(() => {
  players = [];
  resetYouTubeApiForTests();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
  document.head.querySelectorAll(`script[src="${YOUTUBE_API_SRC}"]`).forEach((node) => node.remove());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadYouTubeApi", () => {
  it("injects the official script once and resolves when the API reports ready", async () => {
    const first = loadYouTubeApi();
    const second = loadYouTubeApi();
    expect(document.head.querySelectorAll(`script[src="${YOUTUBE_API_SRC}"]`)).toHaveLength(1);
    installFakeYT();
    window.onYouTubeIframeAPIReady?.();
    await expect(first).resolves.toBe(window.YT);
    await expect(second).resolves.toBe(window.YT);
  });

  it("returns the already loaded API without adding another script", async () => {
    installFakeYT();
    await expect(loadYouTubeApi()).resolves.toBe(window.YT);
    expect(document.head.querySelectorAll(`script[src="${YOUTUBE_API_SRC}"]`)).toHaveLength(0);
  });

  it("rejects with a friendly message when the script cannot load and allows a retry", async () => {
    const pending = loadYouTubeApi();
    document.head.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_API_SRC}"]`)?.onerror?.(new Event("error"));
    await expect(pending).rejects.toThrow("No se pudo cargar el reproductor de YouTube");
    void loadYouTubeApi();
    expect(document.head.querySelectorAll(`script[src="${YOUTUBE_API_SRC}"]`)).toHaveLength(1);
  });
});

describe("describeYouTubeError", () => {
  it.each([[101, /propietario/], [150, /propietario/], [100, /ya no existe/], [153, /origen/], [2, /identificador/], [5, /reproductor integrado/], [999, /No se pudo reproducir/]])(
    "explains code %i in Spanish",
    (code, pattern) => {
      expect(describeYouTubeError(code)).toMatch(pattern);
    },
  );
});

describe("useYouTubePlayer", () => {
  it("creates the player with the official privacy host and the app origin", async () => {
    installFakeYT();
    render(<Harness opts={options({ startSeconds: 31.9 })} />);
    await waitFor(() => expect(players).toHaveLength(1));
    expect(players[0].options.host).toBe("https://www.youtube-nocookie.com");
    expect(players[0].options.playerVars).toMatchObject({ autoplay: 1, start: 31, controls: 1, rel: 0, origin: window.location.origin });
  });

  it("maps player states, reports progress while playing and notifies the end", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    installFakeYT();
    const opts = options();
    render(<Harness opts={opts} />);
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const { events } = players[0].options;
    act(() => events.onReady({ target: players[0], data: 0 }));
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(players[0].setVolume).toHaveBeenCalledWith(50);

    act(() => events.onStateChange({ target: players[0], data: 1 }));
    expect(opts.onPlaying).toHaveBeenLastCalledWith(true);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(opts.onProgress).toHaveBeenCalledWith(12, 200);

    act(() => events.onStateChange({ target: players[0], data: 2 }));
    expect(opts.onPlaying).toHaveBeenLastCalledWith(false);
    vi.mocked(opts.onProgress).mockClear();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(opts.onProgress).not.toHaveBeenCalled();

    act(() => events.onStateChange({ target: players[0], data: 0 }));
    expect(opts.onEnded).toHaveBeenCalledOnce();
  });

  it("surfaces embedded player errors", async () => {
    installFakeYT();
    const opts = options();
    render(<Harness opts={opts} />);
    await waitFor(() => expect(players).toHaveLength(1));
    act(() => players[0].options.events.onError({ target: players[0], data: 101 }));
    expect(opts.onError).toHaveBeenCalledWith(101);
    expect(screen.getByTestId("status")).toHaveTextContent("error");
  });

  it("loads a new video into the existing player and destroys it on unmount", async () => {
    installFakeYT();
    const { rerender, unmount } = render(<Harness opts={options()} />);
    await waitFor(() => expect(players).toHaveLength(1));
    act(() => players[0].options.events.onReady({ target: players[0], data: 0 }));
    rerender(<Harness opts={options({ videoId: "9bZkp7q19f0" })} />);
    expect(players).toHaveLength(1);
    expect(players[0].loadVideoById).toHaveBeenCalledWith({ videoId: "9bZkp7q19f0" });
    unmount();
    expect(players[0].destroy).toHaveBeenCalled();
  });

  it("does not create a player without a video", async () => {
    installFakeYT();
    render(<Harness opts={options({ videoId: null })} />);
    await Promise.resolve();
    expect(players).toHaveLength(0);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
  });
});
