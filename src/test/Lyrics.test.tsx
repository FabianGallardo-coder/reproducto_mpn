import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Lyrics } from "../components/Lyrics";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    fetchLyrics: vi.fn(),
  },
}));

describe("Lyrics", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.fetchLyrics).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading state", () => {
    vi.mocked(api.fetchLyrics).mockReturnValue(new Promise(() => {}));
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    expect(screen.getByText("Syncing lyrics...")).toBeInTheDocument();
  });

  it("shows plain lyrics when no synced available", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 1, track_name: "Song", artist_name: "Artist", instrumental: false,
      plain_lyrics: "Line one\nLine two", synced_lyrics: null,
    });
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    await waitFor(() => {
      expect(screen.getByText("Line one")).toBeInTheDocument();
    });
    expect(screen.getByText("Line two")).toBeInTheDocument();
  });

  it("shows instrumental message", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 2, track_name: "Song", artist_name: "Artist", instrumental: true,
      plain_lyrics: null, synced_lyrics: null,
    });
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    await waitFor(() => {
      expect(screen.getByText("Instrumental")).toBeInTheDocument();
    });
  });

  it("shows nothing when null returned", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue(null as any);
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    await waitFor(() => {
      expect(screen.queryByText("Syncing lyrics...")).not.toBeInTheDocument();
    });
  });

  it("shows timeout message after 4 seconds", async () => {
    vi.mocked(api.fetchLyrics).mockReturnValue(new Promise(() => {}));
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByText("No lyrics available")).toBeInTheDocument();
  });

  it("does not fetch if artist or title empty", () => {
    vi.mocked(api.fetchLyrics).mockReturnValue(new Promise(() => {}));
    render(<Lyrics artist="" title="" position={0} />);
    expect(api.fetchLyrics).not.toHaveBeenCalled();
  });

  it("fetches lyrics with album and duration", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 3, track_name: "B", artist_name: "A", instrumental: false,
      plain_lyrics: "test", synced_lyrics: null,
    });
    render(<Lyrics artist="A" title="B" album="C" duration={200} position={0} />);
    await waitFor(() => {
      expect(api.fetchLyrics).toHaveBeenCalledWith("A", "B", "C", 200);
    });
  });

  it("renders synced lyrics", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 4, track_name: "Song", artist_name: "Artist", instrumental: false,
      plain_lyrics: null, synced_lyrics: "[00:00.00]First line\n[00:05.00]Second line",
    });
    render(<Lyrics artist="Artist" title="Song" position={0} />);
    await waitFor(() => {
      expect(screen.getByText("First line")).toBeInTheDocument();
    });
    expect(screen.getByText("Second line")).toBeInTheDocument();
  });

  it("cancels fetch on unmount", async () => {
    let resolveFn: (v: any) => void;
    vi.mocked(api.fetchLyrics).mockReturnValue(new Promise((r) => { resolveFn = r; }));
    const { unmount } = render(<Lyrics artist="A" title="B" position={0} />);
    unmount();
    resolveFn!({ id: 1, track_name: "B", artist_name: "A", instrumental: false, plain_lyrics: "x", synced_lyrics: null });
    await vi.advanceTimersByTimeAsync(100);
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });

  it("re-fetches when artist changes", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 5, track_name: "Song", artist_name: "New Artist", instrumental: false,
      plain_lyrics: "new", synced_lyrics: null,
    });
    const { rerender } = render(<Lyrics artist="Old" title="Song" position={0} />);
    await waitFor(() => {
      expect(api.fetchLyrics).toHaveBeenCalledTimes(1);
    });
    rerender(<Lyrics artist="New" title="Song" position={0} />);
    await waitFor(() => {
      expect(api.fetchLyrics).toHaveBeenCalledTimes(2);
    });
  });

  it("re-fetches when title changes", async () => {
    vi.mocked(api.fetchLyrics).mockResolvedValue({
      id: 6, track_name: "New Song", artist_name: "Artist", instrumental: false,
      plain_lyrics: "y", synced_lyrics: null,
    });
    const { rerender } = render(<Lyrics artist="A" title="Old" position={0} />);
    await waitFor(() => {
      expect(api.fetchLyrics).toHaveBeenCalledTimes(1);
    });
    rerender(<Lyrics artist="A" title="New" position={0} />);
    await waitFor(() => {
      expect(api.fetchLyrics).toHaveBeenCalledTimes(2);
    });
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(api.fetchLyrics).mockRejectedValue(new Error("network error"));
    render(<Lyrics artist="A" title="B" position={0} />);
    await waitFor(() => {
      expect(screen.queryByText("Syncing lyrics...")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Instrumental")).not.toBeInTheDocument();
  });
});
