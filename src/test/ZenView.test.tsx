import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZenView } from "../components/modes/zen/ZenView";
import type { Track } from "../types";

vi.mock("../lib/api", () => ({
  api: {
    setWindowDecorations: vi.fn().mockResolvedValue(undefined),
    getAudioData: vi.fn().mockResolvedValue({ bins: Array(64).fill(0) }),
  },
}));

vi.mock("../components/Visualizer", () => ({
  Visualizer: () => <div data-testid="visualizer" />,
}));

const track: Track = { path: "/1.mp3", title: "Song", artist: "Artist", album: "A", duration: 180 };

describe("ZenView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders track info when track provided", () => {
    render(<ZenView currentTrack={track} playing={false} onExit={vi.fn()} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("does not render track info when null", () => {
    render(<ZenView currentTrack={null} playing={false} onExit={vi.fn()} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.queryByText("Song")).not.toBeInTheDocument();
  });

  it("calls onExit when Escape pressed", () => {
    const onExit = vi.fn();
    render(<ZenView currentTrack={track} playing={false} onExit={onExit} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("calls onToggle when play button clicked", () => {
    const onToggle = vi.fn();
    render(<ZenView currentTrack={track} playing={false} onExit={vi.fn()} onToggle={onToggle} onNext={vi.fn()} onPrevious={vi.fn()} />);
    screen.getByLabelText("Play").click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows Pause when playing", () => {
    render(<ZenView currentTrack={track} playing={true} onExit={vi.fn()} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
  });

  it("shows Play when not playing", () => {
    render(<ZenView currentTrack={track} playing={false} onExit={vi.fn()} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("calls onNext and onPrevious", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<ZenView currentTrack={track} playing={false} onExit={vi.fn()} onToggle={vi.fn()} onNext={onNext} onPrevious={onPrevious} />);
    screen.getByLabelText("Next track").click();
    screen.getByLabelText("Previous track").click();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("exit button is accessible", () => {
    render(<ZenView currentTrack={track} playing={false} onExit={vi.fn()} onToggle={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByLabelText("Exit zen mode")).toBeInTheDocument();
  });
});
