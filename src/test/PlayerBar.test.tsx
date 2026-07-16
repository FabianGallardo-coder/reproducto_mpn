import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track, RepeatMode } from "../types";

// Mock the store hooks before importing the component so PlayerBar reads from our mocks.
const mockState: {
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  positionValue: number;
} = {
  currentTrack: null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  positionValue: 0,
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
  api: { getCover: vi.fn().mockResolvedValue(null) },
}));

import { PlayerBar } from "../components/layout/PlayerBar";

beforeEach(() => {
  vi.clearAllMocks();
  mockState.currentTrack = null;
  mockState.playing = false;
  mockState.volume = 0.8;
  mockState.shuffle = false;
  mockState.repeat = "off";
  mockState.positionValue = 0;
});

describe("PlayerBar", () => {
  it("shows empty state when no track", () => {
    render(<PlayerBar />);
    expect(screen.getByText("No track playing")).toBeInTheDocument();
  });

  it("shows track title and artist", () => {
    const track: Track = { path: "/1.mp3", title: "Song", artist: "Artist", album: "A", duration: 180 };
    mockState.currentTrack = track;
    render(<PlayerBar />);
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("calls toggle on play/pause click", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Play").click();
    expect(mockActions.toggle).toHaveBeenCalledOnce();
  });

  it("shows Pause label when playing", () => {
    mockState.playing = true;
    render(<PlayerBar />);
    expect(screen.getByLabelText("Pause")).toBeInTheDocument();
  });

  it("calls next and previous", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Next track").click();
    screen.getByLabelText("Previous track").click();
    expect(mockActions.next).toHaveBeenCalledOnce();
    expect(mockActions.previous).toHaveBeenCalledOnce();
  });

  it("calls toggleShuffle", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Toggle shuffle").click();
    expect(mockActions.toggleShuffle).toHaveBeenCalledOnce();
  });

  it("calls cycleRepeat", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Repeat off").click();
    expect(mockActions.cycleRepeat).toHaveBeenCalledOnce();
  });

  it("shows repeat-one icon when repeat is one", () => {
    mockState.repeat = "one";
    render(<PlayerBar />);
    expect(screen.getByLabelText("Repeat one")).toBeInTheDocument();
  });

  it("highlights shuffle when active", () => {
    mockState.shuffle = true;
    render(<PlayerBar />);
    expect(screen.getByLabelText("Toggle shuffle")).toHaveClass("player-bar__btn--active");
  });

  it("displays seek position", () => {
    mockState.positionValue = 65;
    render(<PlayerBar />);
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("volume slider exists", () => {
    render(<PlayerBar />);
    expect(screen.getByLabelText("Volume")).toBeInTheDocument();
  });
});
