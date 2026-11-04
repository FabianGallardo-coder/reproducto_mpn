import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TrackList } from "../components/TrackList";
import { PlayerProvider } from "../hooks/usePlayerStore";
import type { Track } from "../types";

vi.mock("../lib/api", () => ({
  api: {
    getConfig: vi.fn().mockResolvedValue({ favorites: [], custom_radio_stations: [], custom_playlists: [] }),
    setConfig: vi.fn().mockResolvedValue(undefined),
    updateSmtcMetadata: vi.fn().mockResolvedValue(undefined),
    getCover: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

const makeTracks = (n: number): Track[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `/track/${i}.mp3`,
    title: `Track ${i}`,
    artist: `Artist ${i}`,
    album: `Album ${i}`,
    duration: 180 + i,
  }));

describe("TrackList", () => {
  const renderWithProvider = (ui: React.ReactElement) => render(ui, { wrapper: PlayerProvider });

  it("shows loading state", () => {
    renderWithProvider(<TrackList tracks={[]} currentTrack={null} onSelect={vi.fn()} loading />);
    expect(screen.getByText(/Escaneando…?/)).toBeInTheDocument();
  });

  it("shows scan progress counters when provided", () => {
    renderWithProvider(
      <TrackList
        tracks={[]}
        currentTrack={null}
        onSelect={vi.fn()}
        loading
        scanProgress={{ processed: 250, found: 47 }}
      />,
    );
    expect(screen.getByText(/47 encontradas/)).toBeInTheDocument();
    expect(screen.getByText(/250 archivos/)).toBeInTheDocument();
  });

  it("shows empty state", () => {
    renderWithProvider(<TrackList tracks={[]} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No hay canciones. Elegí una carpeta para escanearla.")).toBeInTheDocument();
  });

  it("renders tracks", () => {
    const tracks = makeTracks(3);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.getByText("Track 1")).toBeInTheDocument();
    expect(screen.getByText("Track 2")).toBeInTheDocument();
  });

  it("calls onSelect when clicking a track", () => {
    const tracks = makeTracks(2);
    const onSelect = vi.fn();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    screen.getByText("Track 0").click();
    expect(onSelect).toHaveBeenCalledWith(tracks[0]);
  });

  it("highlights active track", () => {
    const tracks = makeTracks(2);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={tracks[1]} onSelect={vi.fn()} />);
    const items = screen.getAllByRole("option");
    expect(items[0]).not.toHaveClass("track-list__item--active");
    expect(items[1]).toHaveClass("track-list__item--active");
  });

  it("track items are keyboard accessible", () => {
    const tracks = makeTracks(1);
    const onSelect = vi.fn();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    const item = screen.getByRole("option");
    expect(item).toHaveAttribute("tabindex", "0");
    expect(item).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect on Enter key", () => {
    const tracks = makeTracks(1);
    const onSelect = vi.fn();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    const item = screen.getByRole("option");
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("renders many tracks (virtualization)", () => {
    const tracks = makeTracks(1000);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.queryByText("Track 999")).not.toBeInTheDocument();
  });

  it("renders heart icons for each track", () => {
    const tracks = makeTracks(3);
    const onSelect = vi.fn();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);

    // Should have 3 heart icons (one for each track)
    const heartIconElements = document.getElementsByClassName("track-list__heart-icon");
    expect(heartIconElements.length).toBe(3);

    // Each heart icon should have the heart-icon class
    Array.from(heartIconElements).forEach(icon => {
      expect(icon).toHaveClass("track-list__heart-icon");
    });
  });

  it("marks active track with eq indicator", () => {
    const tracks = makeTracks(3);
    const onSelect = vi.fn();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={tracks[1]} onSelect={onSelect} />);

    // Only the active track shows the eq indicator instead of the music icon
    expect(document.getElementsByClassName("track-list__eq").length).toBe(1);
    expect(document.getElementsByClassName("track-list__heart-icon").length).toBe(2);
  });

  it("renders heart icons with correct size", () => {
    const tracks = makeTracks(1);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);

    const heartIconElements = document.getElementsByClassName("track-list__heart-icon");
    expect(heartIconElements.length).toBe(1);
    const heartIcon = heartIconElements[0];

    // Check that the heart icon has the correct size (16px as specified in TrackItem)
    expect(heartIcon).toHaveAttribute("width", "16");
    expect(heartIcon).toHaveAttribute("height", "16");
  });

  it("handles 10k tracks without OOM", () => {
    const tracks = makeTracks(10000);
    const start = performance.now();
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    const elapsed = performance.now() - start;
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.queryByText("Track 9999")).not.toBeInTheDocument();
    expect(elapsed).toBeLessThan(5000);
  });

  it("scrolls to show different tracks", () => {
    const tracks = makeTracks(100);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.queryByText("Track 50")).not.toBeInTheDocument();
  });

  it("has listbox role and aria-label", () => {
    const tracks = makeTracks(3);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Lista de canciones");
  });

  it("track items have aria-label with title and artist", () => {
    const tracks = makeTracks(2);
    renderWithProvider(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-label", "Reproducir Track 0 de Artist 0");
    expect(items[1]).toHaveAttribute("aria-label", "Reproducir Track 1 de Artist 1");
  });
});
