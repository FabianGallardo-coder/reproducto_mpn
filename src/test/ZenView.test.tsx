import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZenView } from "../components/modes/zen/ZenView";
import type { Track } from "../types";

vi.mock("../lib/api", () => ({
  api: {
    setWindowMode: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../components/Visualizer", () => ({
  Visualizer: () => <div data-testid="visualizer" />,
}));

const track: Track = { path: "/1.mp3", title: "Song", artist: "Artist", album: "A", duration: 180 };

function renderZen(overrides: Partial<React.ComponentProps<typeof ZenView>> = {}) {
  return render(
    <ZenView
      currentTrack={track}
      playing={false}
      onExit={vi.fn()}
      onToggle={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ZenView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders track info when track provided", () => {
    renderZen();
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("does not render track info when null", () => {
    renderZen({ currentTrack: null });
    expect(screen.queryByText("Song")).not.toBeInTheDocument();
  });

  it("calls onExit when Escape pressed", () => {
    const onExit = vi.fn();
    renderZen({ onExit });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("calls onToggle when play button clicked", () => {
    const onToggle = vi.fn();
    renderZen({ onToggle });
    screen.getByLabelText("Reproducir").click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows Pausar when playing", () => {
    renderZen({ playing: true });
    expect(screen.getByLabelText("Pausar")).toBeInTheDocument();
  });

  it("shows Reproducir when not playing", () => {
    renderZen();
    expect(screen.getByLabelText("Reproducir")).toBeInTheDocument();
  });

  it("calls onNext and onPrevious", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    renderZen({ onNext, onPrevious });
    screen.getByLabelText("Pista siguiente").click();
    screen.getByLabelText("Pista anterior").click();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("exit button is accessible", () => {
    renderZen();
    expect(screen.getByLabelText("Salir del modo zen")).toBeInTheDocument();
  });
});
