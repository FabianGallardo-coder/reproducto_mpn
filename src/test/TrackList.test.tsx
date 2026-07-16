import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TrackList } from "../components/TrackList";
import type { Track } from "../types";

const makeTracks = (n: number): Track[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `/track/${i}.mp3`,
    title: `Track ${i}`,
    artist: `Artist ${i}`,
    album: `Album ${i}`,
    duration: 180 + i,
  }));

describe("TrackList", () => {
  it("shows loading state", () => {
    render(<TrackList tracks={[]} currentTrack={null} onSelect={vi.fn()} loading />);
    expect(screen.getByText("Scanning...")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<TrackList tracks={[]} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No tracks. Scan a folder.")).toBeInTheDocument();
  });

  it("renders tracks", () => {
    const tracks = makeTracks(3);
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.getByText("Track 1")).toBeInTheDocument();
    expect(screen.getByText("Track 2")).toBeInTheDocument();
  });

  it("calls onSelect when clicking a track", () => {
    const tracks = makeTracks(2);
    const onSelect = vi.fn();
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    screen.getByText("Track 0").click();
    expect(onSelect).toHaveBeenCalledWith(tracks[0]);
  });

  it("highlights active track", () => {
    const tracks = makeTracks(2);
    render(<TrackList tracks={tracks} currentTrack={tracks[1]} onSelect={vi.fn()} />);
    const items = screen.getAllByRole("option");
    expect(items[0]).not.toHaveClass("track-list__item--active");
    expect(items[1]).toHaveClass("track-list__item--active");
  });

  it("track items are keyboard accessible", () => {
    const tracks = makeTracks(1);
    const onSelect = vi.fn();
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    const item = screen.getByRole("option");
    expect(item).toHaveAttribute("tabindex", "0");
    expect(item).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect on Enter key", () => {
    const tracks = makeTracks(1);
    const onSelect = vi.fn();
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);
    const item = screen.getByRole("option");
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("renders many tracks (virtualization)", () => {
    const tracks = makeTracks(1000);
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);
    expect(screen.getByText("Track 0")).toBeInTheDocument();
    expect(screen.queryByText("Track 999")).not.toBeInTheDocument();
  });

  it("renders heart icons for each track", () => {
    const tracks = makeTracks(3);
    const onSelect = vi.fn();
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={onSelect} />);

    // Should have 3 heart icons (one for each track)
    const heartIconElements = document.getElementsByClassName("track-list__heart-icon");
    expect(heartIconElements.length).toBe(3);

    // Each heart icon should have the heart-icon class
    Array.from(heartIconElements).forEach(icon => {
      expect(icon).toHaveClass("track-list__heart-icon");
    });
  });

  it("marks active track's heart icon as active", () => {
    const tracks = makeTracks(3);
    const onSelect = vi.fn();
    render(<TrackList tracks={tracks} currentTrack={tracks[1]} onSelect={onSelect} />);

    // Get all heart icon elements
    const heartIconElements = document.getElementsByClassName("track-list__heart-icon");

    // First track (index 0) should not be active
    expect(heartIconElements[0]).not.toHaveClass("track-list__heart-icon--active");

    // Second track (index 1) should be active
    expect(heartIconElements[1]).toHaveClass("track-list__heart-icon--active");

    // Third track (index 2) should not be active
    expect(heartIconElements[2]).not.toHaveClass("track-list__heart-icon--active");
  });

  it("renders heart icons with correct size", () => {
    const tracks = makeTracks(1);
    render(<TrackList tracks={tracks} currentTrack={null} onSelect={vi.fn()} />);

    const heartIconElements = document.getElementsByClassName("track-list__heart-icon");
    expect(heartIconElements.length).toBe(1);
    const heartIcon = heartIconElements[0];

    // Check that the heart icon has the correct size (16px as specified in TrackItem)
    expect(heartIcon).toHaveAttribute("width", "16");
    expect(heartIcon).toHaveAttribute("height", "16");
  });
});
