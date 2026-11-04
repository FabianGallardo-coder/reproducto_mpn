import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";

const state = {
  currentTrack: null as Track | null,
  queue: [] as Track[],
  favorites: [] as string[],
  positionValue: 0,
  positionRef: { current: 0 },
  playing: true,
  volume: 0.8,
};
const actions = {
  toggleFavorite: vi.fn(),
  playCollection: vi.fn(),
  playYouTube: vi.fn(),
  reportYouTubeState: vi.fn(),
  youtubeEnded: vi.fn(),
  registerYouTubeController: vi.fn(),
  stopYouTube: vi.fn(),
};

vi.mock("../hooks/usePlayerStore", () => ({ usePlayerState: () => state, usePlayerActions: () => actions }));
vi.mock("../lib/useCoverArt", () => ({ useCoverArt: () => null }));
vi.mock("../components/Lyrics", () => ({ Lyrics: ({ title }: { title: string }) => <div data-testid="lyrics">Lyrics for {title}</div> }));
vi.mock("../lib/openExternal", () => ({ openExternal: vi.fn() }));

const player = {
  mountRef: { current: null as HTMLDivElement | null },
  controller: { play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(), setVolume: vi.fn() },
  status: "ready" as "idle" | "loading" | "ready" | "error",
  loadError: null as string | null,
  lastOptions: null as null | { videoId: string | null; onError: (code: number) => void; onEnded: () => void },
};
vi.mock("../hooks/useYouTubePlayer", () => ({
  useYouTubePlayer: (options: NonNullable<typeof player.lastOptions>) => {
    player.lastOptions = options;
    return { mountRef: player.mountRef, controller: player.controller, status: player.status, loadError: player.loadError };
  },
}));

import { NowPlaying } from "../components/nowplaying/NowPlaying";
import { YouTubeHost } from "../components/nowplaying/YouTubeHost";
import { YouTubeStageProvider } from "../components/nowplaying/YouTubeStage";
import { openExternal } from "../lib/openExternal";
import { NavigationProvider, useNavigation } from "../hooks/useNavigation";

const local: Track = { path: "C:\\m\\a.mp3", title: "Blue Hour", artist: "Northbound", album: "Night Drive", duration: 205 };
const other: Track = { path: "C:\\m\\b.mp3", title: "Afterglow", artist: "Northbound", album: "Night Drive", duration: 190 };
const video: Track = { path: "youtube:dQw4w9WgXcQ", title: "Live Session", artist: "Channel", album: "YouTube", duration: 215 };
const video2: Track = { path: "youtube:9bZkp7q19f0", title: "Second Session", artist: "Channel", album: "YouTube", duration: 180 };

function RouteProbe() {
  const { route } = useNavigation();
  return <output data-testid="route">{route}</output>;
}

function renderNowPlaying() {
  return render(
    <NavigationProvider initialRoute="reproduciendo">
      <YouTubeStageProvider>
        <NowPlaying />
        <YouTubeHost />
      </YouTubeStageProvider>
      <RouteProbe />
    </NavigationProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  state.currentTrack = null;
  state.queue = [];
  state.favorites = [];
  state.playing = true;
  player.status = "ready";
  player.loadError = null;
});

describe("NowPlaying page", () => {
  it("shows an empty state when nothing is playing", () => {
    renderNowPlaying();
    expect(screen.getByRole("heading", { name: "Nada en reproducción" })).toBeInTheDocument();
    expect(screen.getByText("La cola está vacía. Elegí una canción para empezar.")).toBeInTheDocument();
  });

  it("shows the local track, toggles its favorite and closes with the chevron and Escape", () => {
    state.currentTrack = local;
    state.queue = [local, other];
    renderNowPlaying();
    expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument();
    expect(screen.getAllByText("Northbound").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Agregar a favoritos" }));
    expect(actions.toggleFavorite).toHaveBeenCalledWith(local.path);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar Reproduciendo" }));
    expect(screen.getByTestId("route")).toHaveTextContent("inicio");
  });

  it("closes with Escape", () => {
    state.currentTrack = local;
    state.queue = [local];
    renderNowPlaying();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("route")).toHaveTextContent("inicio");
  });

  it("lists the queue, marks the current item and plays the selected one", () => {
    state.currentTrack = local;
    state.queue = [local, other];
    renderNowPlaying();
    const list = screen.getByRole("list", { name: "Cola de reproducción" });
    expect(within(list).getByRole("button", { name: /Blue Hour/ })).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(list).getByRole("button", { name: /Afterglow/ }));
    expect(actions.playCollection).toHaveBeenCalledWith([local, other], 1);
  });

  it("stores the autoplay switch preference", () => {
    state.currentTrack = local;
    state.queue = [local];
    renderNowPlaying();
    const toggle = screen.getByRole("switch", { name: "Autoplay" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem("flowplayer-autoplay")).toBe("off");
  });

  it("switches tabs with the mouse and the arrow keys", () => {
    state.currentTrack = local;
    state.queue = [local];
    renderNowPlaying();
    const tabs = screen.getByRole("tablist", { name: "Panel de reproducción" });
    expect(within(tabs).getByRole("tab", { name: "Cola" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(tabs).getByRole("tab", { name: "Letra" }));
    expect(screen.getByTestId("lyrics")).toHaveTextContent("Lyrics for Blue Hour");
    fireEvent.keyDown(within(tabs).getByRole("tab", { name: "Letra" }), { key: "ArrowRight" });
    expect(within(tabs).getByRole("tab", { name: "Detalles" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Archivo local")).toBeInTheDocument();
    fireEvent.keyDown(within(tabs).getByRole("tab", { name: "Detalles" }), { key: "Home" });
    expect(within(tabs).getByRole("tab", { name: "Cola" })).toHaveAttribute("aria-selected", "true");
  });

  it("plays YouTube queue items with the official player and hides local-only actions", () => {
    state.currentTrack = video;
    state.queue = [video, video2];
    renderNowPlaying();
    expect(screen.queryByRole("button", { name: /favoritos/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("youtube-stage")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Second Session/ }));
    expect(actions.playYouTube).toHaveBeenCalledWith(
      expect.objectContaining({ id: "9bZkp7q19f0" }),
      [expect.objectContaining({ id: "dQw4w9WgXcQ" }), expect.objectContaining({ id: "9bZkp7q19f0" })],
    );
    fireEvent.click(screen.getByRole("tab", { name: "Letra" }));
    expect(screen.getByText(/no están disponibles para videos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Detalles" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir en YouTube/ }));
    expect(openExternal).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("YouTubeHost", () => {
  it("renders nothing for local tracks", () => {
    state.currentTrack = local;
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /></YouTubeStageProvider></NavigationProvider>);
    expect(screen.queryByRole("region", { name: "Reproductor oficial de YouTube" })).not.toBeInTheDocument();
  });

  it("floats with visible controls outside the Now Playing page and can be stopped", () => {
    state.currentTrack = video;
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /><RouteProbe /></YouTubeStageProvider></NavigationProvider>);
    const host = screen.getByRole("region", { name: "Reproductor oficial de YouTube" });
    expect(host).toHaveClass("yt-host--float");
    expect(player.lastOptions?.videoId).toBe("dQw4w9WgXcQ");
    expect(actions.registerYouTubeController).toHaveBeenCalledWith(player.controller);
    fireEvent.click(within(host).getByRole("button", { name: "Abrir Reproduciendo" }));
    expect(screen.getByTestId("route")).toHaveTextContent("reproduciendo");
    fireEvent.click(within(host).getByRole("button", { name: "Cerrar reproductor de YouTube" }));
    expect(actions.stopYouTube).toHaveBeenCalledOnce();
  });

  it("docks over the stage on the Now Playing page", () => {
    state.currentTrack = video;
    state.queue = [video];
    renderNowPlaying();
    expect(screen.getByRole("region", { name: "Reproductor oficial de YouTube" })).toHaveClass("yt-host--stage");
  });

  it("forwards player events to the store", () => {
    state.currentTrack = video;
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /></YouTubeStageProvider></NavigationProvider>);
    player.lastOptions?.onEnded();
    expect(actions.youtubeEnded).toHaveBeenCalledOnce();
  });

  it("explains embedding errors and offers the official site as a fallback", () => {
    state.currentTrack = video;
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /></YouTubeStageProvider></NavigationProvider>);
    act(() => player.lastOptions?.onError(101));
    expect(screen.getByRole("alert")).toHaveTextContent("El propietario no permite reproducir este video fuera de YouTube.");
    expect(actions.reportYouTubeState).toHaveBeenCalledWith({ playing: false });
    fireEvent.click(screen.getByRole("button", { name: /Abrir en YouTube/ }));
    expect(openExternal).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("shows script-load failures", () => {
    state.currentTrack = video;
    player.loadError = "No se pudo cargar el reproductor de YouTube. Revisá tu conexión.";
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /></YouTubeStageProvider></NavigationProvider>);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el reproductor");
  });

  it("announces the loading state", () => {
    state.currentTrack = video;
    player.status = "loading";
    render(<NavigationProvider><YouTubeStageProvider><YouTubeHost /></YouTubeStageProvider></NavigationProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando reproductor…");
  });
});

describe("navigation back from Now Playing", () => {
  it("returns to the page that was open before", () => {
    function Harness() {
      const { navigate, closeNowPlaying, route } = useNavigation();
      return (
        <>
          <output data-testid="route">{route}</output>
          <button onClick={() => navigate("estadisticas")}>stats</button>
          <button onClick={() => navigate("reproduciendo")}>open</button>
          <button onClick={closeNowPlaying}>close</button>
        </>
      );
    }
    render(<NavigationProvider><Harness /></NavigationProvider>);
    fireEvent.click(screen.getByText("stats"));
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("route")).toHaveTextContent("reproduciendo");
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("route")).toHaveTextContent("estadisticas");
  });
});
