import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowView } from "../components/modes/flow/FlowView";
import { MiniView } from "../components/modes/mini/MiniView";
import type { Track } from "../types";

const mockToggleFavorite = vi.fn();

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => ({ favorites: [] }),
  usePlayerActions: () => ({ toggleFavorite: mockToggleFavorite }),
}));

vi.mock("../lib/useCoverArt", () => ({ useCoverArt: () => null }));
vi.mock("../components/PomodoroTimer", () => ({
  PomodoroTimer: () => <div data-testid="pomodoro">Focus timer</div>,
}));
vi.mock("../components/Visualizer", () => ({
  Visualizer: ({ playing }: { playing: boolean }) => (
    <div data-testid="visualizer">{playing ? "Playing visualization" : "Paused visualization"}</div>
  ),
}));
vi.mock("../components/Lyrics", () => ({
  Lyrics: ({ title }: { title: string }) => <div data-testid="lyrics">Lyrics for {title}</div>,
}));

const track: Track = {
  path: "/music/blue-hour.mp3",
  title: "Blue Hour",
  artist: "Northbound",
  album: "Night Drive",
  duration: 205,
};

describe("FlowView", () => {
  it("renders Flow tools and an explicit no-track state", () => {
    render(
      <FlowView
        tracks={[]}
        currentTrack={null}
        playing={false}
        position={0}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pomodoro")).toHaveTextContent("Focus timer");
    expect(screen.getByTestId("visualizer")).toHaveTextContent("Paused visualization");
    expect(screen.getByText("Nada en reproducción")).toBeInTheDocument();
    expect(screen.getByText("No hay canciones. Elegí una carpeta para escanearla.")).toBeInTheDocument();
  });

  it("shows the current track and lyrics while scanning progress is announced", () => {
    render(
      <FlowView
        tracks={[track]}
        currentTrack={track}
        playing
        position={42}
        onSelect={vi.fn()}
        loading
        scanProgress={{ processed: 8, found: 1 }}
      />,
    );

    expect(screen.getByText("Blue Hour")).toBeInTheDocument();
    expect(screen.getByText("Northbound")).toBeInTheDocument();
    expect(screen.getByTestId("lyrics")).toHaveTextContent("Lyrics for Blue Hour");
    expect(screen.getByTestId("visualizer")).toHaveTextContent("Playing visualization");
    expect(screen.getByRole("status")).toHaveTextContent("Escaneando… 1 encontradas · 8 archivos");
  });
});

describe("MiniView", () => {
  it("renders the no-track state with usable playback and seek controls", () => {
    const onToggle = vi.fn();
    const onSeek = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onExpand = vi.fn();
    render(
      <MiniView
        currentTrack={null}
        playing={false}
        positionValue={0}
        onToggle={onToggle}
        onNext={onNext}
        onPrevious={onPrevious}
        onSeek={onSeek}
        onExpand={onExpand}
      />,
    );

    expect(screen.getByText("Nada en reproducción")).toBeInTheDocument();
    const seek = screen.getByRole("slider", { name: "Posición" });
    expect(seek).toHaveAttribute("max", "1");
    fireEvent.change(seek, { target: { value: "0.5" } });
    expect(onSeek).toHaveBeenCalledWith(0.5);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    expect(onToggle).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Pista anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Pista siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Expandir" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it("shows track metadata and playback state in the compact player", () => {
    render(
      <MiniView
        currentTrack={track}
        playing
        positionValue={45}
        onToggle={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onSeek={vi.fn()}
        onExpand={vi.fn()}
      />,
    );

    expect(screen.getByText("Blue Hour")).toBeInTheDocument();
    expect(screen.getByText("Northbound")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(screen.getByText("0:45")).toBeInTheDocument();
    expect(screen.getByText("3:25")).toBeInTheDocument();
  });
});
