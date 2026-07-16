import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState: {
  currentTrack: { path: string; title: string; artist: string; album: string; duration: number } | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  positionValue: number;
  error: string | null;
} = {
  currentTrack: null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  positionValue: 0,
  error: null,
};

const mockActions = {
  toggle: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVolume: vi.fn(),
  seek: vi.fn(),
  toggleShuffle: vi.fn(),
  cycleRepeat: vi.fn(),
  loadLibrary: vi.fn(),
  playTrack: vi.fn(),
  playAtIndex: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  setShuffle: vi.fn(),
  setRepeat: vi.fn(),
  search: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => mockState,
  usePlayerActions: () => mockActions,
  usePlayerStore: () => ({ ...mockState, ...mockActions }),
}));

vi.mock("../lib/api", () => ({
  api: { playUrl: vi.fn(), listRadioStations: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../lib/useCoverArt", () => ({ useCoverArt: () => null }));

import { AppLayout } from "../components/layout/AppLayout";

beforeEach(() => {
  vi.clearAllMocks();
  mockState.error = null;
});

describe("AppLayout", () => {
  it("renders children in normal mode", () => {
    render(
      <AppLayout mode="normal" onModeChange={vi.fn()}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders zen mode without sidebar", () => {
    render(
      <AppLayout mode="zen" onModeChange={vi.fn()}>
        <div>Zen content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Zen content")).toBeInTheDocument();
  });

  it("shows error toast when error present", () => {
    mockState.error = "Something broke";
    render(
      <AppLayout mode="normal" onModeChange={vi.fn()}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("calls clearError when clicking error toast", () => {
    mockState.error = "Error msg";
    render(
      <AppLayout mode="normal" onModeChange={vi.fn()}>
        <div>Content</div>
      </AppLayout>,
    );
    screen.getByText("Error msg").click();
    expect(mockActions.clearError).toHaveBeenCalledOnce();
  });

  it("shows Library and Radio tabs", () => {
    render(
      <AppLayout mode="normal" onModeChange={vi.fn()}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Radio")).toBeInTheDocument();
  });

  it("renders player bar", () => {
    render(
      <AppLayout mode="normal" onModeChange={vi.fn()}>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText("No track playing")).toBeInTheDocument();
  });
});
