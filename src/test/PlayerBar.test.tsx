import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Track, RepeatMode } from "../types";

const mockState: {
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  positionValue: number;
  positionRef: { current: number };
  favorites: string[];
} = {
  currentTrack: null,
  playing: false,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  positionValue: 0,
  positionRef: { current: 0 },
  favorites: [],
};

const mockActions = {
  toggle: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVolume: vi.fn(),
  seek: vi.fn(),
  toggleShuffle: vi.fn(),
  cycleRepeat: vi.fn(),
  toggleFavorite: vi.fn(),
};

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => mockState,
  usePlayerActions: () => mockActions,
}));

vi.mock("../lib/api", () => ({
  api: { getCover: vi.fn().mockResolvedValue(null) },
}));

const mockNavigate = vi.fn();
vi.mock("../hooks/useNavigation", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import { PlayerBar } from "../components/layout/PlayerBar";

const track: Track = { path: "/1.mp3", title: "Song", artist: "Artist", album: "A", duration: 180 };

beforeEach(() => {
  vi.clearAllMocks();
  mockState.currentTrack = null;
  mockState.playing = false;
  mockState.volume = 0.8;
  mockState.shuffle = false;
  mockState.repeat = "off";
  mockState.positionValue = 0;
  mockState.positionRef.current = 0;
  mockState.favorites = [];
});

describe("PlayerBar", () => {
  it("shows the empty state when there is no track", () => {
    render(<PlayerBar />);
    expect(screen.getByText("Nada en reproducción")).toBeInTheDocument();
  });

  it("shows track title and artist", () => {
    mockState.currentTrack = track;
    render(<PlayerBar />);
    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("opens the Now Playing page from the track button", () => {
    mockState.currentTrack = track;
    render(<PlayerBar />);
    screen.getByRole("button", { name: "Abrir Reproduciendo: Song" }).click();
    expect(mockNavigate).toHaveBeenCalledWith("reproduciendo");
  });

  it("shows the YouTube thumbnail and hides the favorites toggle for online videos", () => {
    mockState.currentTrack = { path: "youtube:dQw4w9WgXcQ", title: "Video", artist: "Channel", album: "YouTube", duration: 212 };
    const { container } = render(<PlayerBar />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(screen.queryByLabelText("Favorito")).not.toBeInTheDocument();
  });

  it("toggles the favorite of the current track and reflects its state", () => {
    mockState.currentTrack = track;
    mockState.favorites = [track.path];
    render(<PlayerBar />);
    const favorite = screen.getByLabelText("Favorito");
    expect(favorite).toHaveAttribute("aria-pressed", "true");
    expect(favorite).toHaveClass("player-bar__btn--faved");
    favorite.click();
    expect(mockActions.toggleFavorite).toHaveBeenCalledWith(track.path);
  });

  it("calls toggle on play/pause click", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Reproducir").click();
    expect(mockActions.toggle).toHaveBeenCalledOnce();
  });

  it("shows the Pausar label when playing", () => {
    mockState.playing = true;
    render(<PlayerBar />);
    expect(screen.getByLabelText("Pausar")).toBeInTheDocument();
  });

  it("calls next and previous", () => {
    render(<PlayerBar />);
    screen.getByLabelText("Siguiente").click();
    screen.getByLabelText("Anterior").click();
    expect(mockActions.next).toHaveBeenCalledOnce();
    expect(mockActions.previous).toHaveBeenCalledOnce();
  });

  it("toggles shuffle and exposes its state", () => {
    mockState.shuffle = true;
    render(<PlayerBar />);
    const shuffle = screen.getByLabelText("Aleatorio");
    expect(shuffle).toHaveClass("player-bar__btn--active");
    expect(shuffle).toHaveAttribute("aria-pressed", "true");
    shuffle.click();
    expect(mockActions.toggleShuffle).toHaveBeenCalledOnce();
  });

  it("cycles repeat and labels each mode", () => {
    const { unmount } = render(<PlayerBar />);
    screen.getByLabelText("Repetir desactivado").click();
    expect(mockActions.cycleRepeat).toHaveBeenCalledOnce();
    unmount();
    mockState.repeat = "all";
    const second = render(<PlayerBar />);
    expect(screen.getByLabelText("Repetir todo")).toBeInTheDocument();
    second.unmount();
    mockState.repeat = "one";
    render(<PlayerBar />);
    expect(screen.getByLabelText("Repetir una canción")).toBeInTheDocument();
  });

  it("displays the elapsed time from the position ref", async () => {
    mockState.currentTrack = track;
    mockState.positionRef.current = 65;
    render(<PlayerBar />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("lets keyboard and mouse users seek and disables seeking without a duration", () => {
    mockState.currentTrack = track;
    const { rerender } = render(<PlayerBar />);
    const seek = screen.getByLabelText("Posición");
    expect(seek).toBeEnabled();
    fireEvent.change(seek, { target: { value: "50" } });
    expect(mockActions.seek).toHaveBeenCalledWith(90);

    mockState.currentTrack = { ...track, duration: 0 };
    rerender(<PlayerBar />);
    expect(screen.getByLabelText("Posición")).toBeDisabled();
  });

  it("changes the volume", () => {
    render(<PlayerBar />);
    fireEvent.change(screen.getByLabelText("Volumen"), { target: { value: "0.25" } });
    expect(mockActions.setVolume).toHaveBeenCalledWith(0.25);
  });

  it("only animates the time while playing", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    mockState.currentTrack = track;
    const { unmount } = render(<PlayerBar />);
    expect(raf).not.toHaveBeenCalled();
    unmount();
    mockState.playing = true;
    render(<PlayerBar />);
    expect(raf).toHaveBeenCalled();
    raf.mockRestore();
  });
});
