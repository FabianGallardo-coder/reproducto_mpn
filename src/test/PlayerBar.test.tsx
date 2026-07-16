import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlayerBar } from "../components/layout/PlayerBar";
import type { Track, RepeatMode } from "../types";

vi.mock("../lib/api", () => ({
  api: { getCover: vi.fn().mockResolvedValue(null) },
}));

const baseProps = {
  currentTrack: null as Track | null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off" as RepeatMode,
  positionValue: 0,
  onToggle: vi.fn(),
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onVolumeChange: vi.fn(),
  onSeek: vi.fn(),
  onToggleShuffle: vi.fn(),
  onCycleRepeat: vi.fn(),
};

describe("PlayerBar", () => {
  it("shows empty state when no track", () => {
    render(<PlayerBar {...baseProps} />);
    expect(screen.getByText("No track playing")).toBeInTheDocument();
  });

  it("shows track title and artist", () => {
    const track: Track = { path: "/1.mp3", title: "Song", artist: "Artist", album: "A", duration: 180 };
    render(<PlayerBar {...baseProps} currentTrack={track} />);
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("calls onToggle on play/pause click", () => {
    const onToggle = vi.fn();
    render(<PlayerBar {...baseProps} onToggle={onToggle} />);
    screen.getByLabelText("Play").click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows Pause label when playing", () => {
    render(<PlayerBar {...baseProps} playing />);
    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
  });

  it("calls onNext and onPrevious", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<PlayerBar {...baseProps} onNext={onNext} onPrevious={onPrevious} />);
    screen.getByLabelText("Next track").click();
    screen.getByLabelText("Previous track").click();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("calls onToggleShuffle", () => {
    const onToggleShuffle = vi.fn();
    render(<PlayerBar {...baseProps} onToggleShuffle={onToggleShuffle} />);
    screen.getByLabelText("Toggle shuffle").click();
    expect(onToggleShuffle).toHaveBeenCalledOnce();
  });

  it("calls onCycleRepeat", () => {
    const onCycleRepeat = vi.fn();
    render(<PlayerBar {...baseProps} onCycleRepeat={onCycleRepeat} />);
    screen.getByLabelText("Repeat off").click();
    expect(onCycleRepeat).toHaveBeenCalledOnce();
  });

  it("shows repeat-one icon when repeat is one", () => {
    render(<PlayerBar {...baseProps} repeat="one" />);
    expect(screen.getByLabelText("Repeat one")).toBeInTheDocument();
  });

  it("highlights shuffle when active", () => {
    render(<PlayerBar {...baseProps} shuffle />);
    expect(screen.getByLabelText("Toggle shuffle")).toHaveClass("player-bar__btn--active");
  });

  it("displays seek position", () => {
    render(<PlayerBar {...baseProps} positionValue={65} />);
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("volume slider exists", () => {
    render(<PlayerBar {...baseProps} />);
    expect(screen.getByLabelText("Volume")).toBeInTheDocument();
  });
});
