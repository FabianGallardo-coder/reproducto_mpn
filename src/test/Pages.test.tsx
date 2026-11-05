import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "../types";
import type { PlayHistoryEntry } from "../types/history";

const state = {
  tracks: [] as Track[],
  favorites: [] as string[],
  customPlaylists: [] as { name: string; tracks: string[] }[],
  currentTrack: null as Track | null,
  loading: false,
  scanProgress: null,
};
const actions = {
  toggleFavorite: vi.fn(),
  playCollection: vi.fn(),
  playYouTube: vi.fn(),
  playVirtualTrack: vi.fn(),
  playTrack: vi.fn(),
};
const history = { entries: [] as PlayHistoryEntry[], loading: false, refresh: vi.fn(), clear: vi.fn().mockResolvedValue(undefined) };
const online = { isOnline: true };

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => state,
  usePlayerActions: () => actions,
}));
vi.mock("../hooks/usePlayHistory", () => ({ usePlayHistory: () => history, HISTORY_CHANGED_EVENT: "flowplayer-history-changed" }));
vi.mock("../hooks/useOnlineStatus", () => ({ useOnlineStatus: () => online }));
vi.mock("../lib/useCoverArt", () => ({ useCoverArt: () => null }));
vi.mock("../lib/api", () => ({
  api: {
    listRadioStations: vi.fn(),
    youtubeSearch: vi.fn(),
    youtubeInspect: vi.fn(),
    youtubeEnqueue: vi.fn(),
  },
}));

import { api } from "../lib/api";
import { NavigationProvider, useNavigation } from "../hooks/useNavigation";
import { InicioPage, greeting } from "../pages/InicioPage";
import { BuscarPage } from "../pages/BuscarPage";
import { EstadisticasPage } from "../pages/EstadisticasPage";
import { ConfiguracionPage } from "../pages/ConfiguracionPage";
import type { LibraryControls } from "../pages/pageTypes";

const controls: LibraryControls = {
  musicFolder: "C:\\Music",
  onSelectFolder: vi.fn(),
  onOpenFile: vi.fn(),
  onShowShortcuts: vi.fn(),
  onShowAbout: vi.fn(),
};

const tracks: Track[] = [
  { path: "C:\\m\\blue.mp3", title: "Blue Hour", artist: "Northbound", album: "Night Drive", duration: 205 },
  { path: "C:\\m\\moons.mp3", title: "Paper Moons", artist: "Lumen", album: "Moons", duration: 232 },
  { path: "C:\\m\\tide.mp3", title: "Low Tide", artist: "Harbor", album: "Tide", duration: 251 },
];

function RouteProbe() {
  const { route, params } = useNavigation();
  return <output data-testid="route">{`${route}:${params.section ?? ""}`}</output>;
}

function renderPage(page: React.ReactElement) {
  return render(<NavigationProvider>{page}<RouteProbe /></NavigationProvider>);
}

function historyEntry(track: Track, hoursAgo: number, source: PlayHistoryEntry["source"] = "local"): PlayHistoryEntry {
  return { ...track, source, playedAt: Date.now() - hoursAgo * 3_600_000 };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tracks = [];
  state.favorites = [];
  state.customPlaylists = [];
  state.currentTrack = null;
  history.entries = [];
  history.loading = false;
  online.isOnline = true;
  vi.mocked(api.listRadioStations).mockResolvedValue([
    { name: "Groove Salad", genre: "Ambient", url: "https://radio.example/groove", description: "" },
    { name: "Blue Jazz FM", genre: "Jazz", url: "https://radio.example/jazz", description: "" },
  ]);
  vi.mocked(api.youtubeSearch).mockResolvedValue([
    { id: "dQw4w9WgXcQ", title: "Blue Hour (Live)", artist: "Northbound", duration: 215, available: true },
  ]);
  vi.mocked(api.youtubeEnqueue).mockResolvedValue("job");
});

describe("InicioPage", () => {
  it.each([[3, "Buenas noches"], [8, "Buenos días"], [15, "Buenas tardes"], [22, "Buenas noches"]])(
    "greets at %i:00 with %s",
    (hour, expected) => expect(greeting(hour)).toBe(expected),
  );

  it("invites to pick a folder when there is nothing to show", () => {
    renderPage(<InicioPage controls={controls} />);
    expect(screen.getByText("Tu música, a un clic")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir carpeta" }));
    expect(controls.onSelectFolder).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Buscar música" }));
    expect(screen.getByTestId("route")).toHaveTextContent("buscar");
  });

  it("opens collections from the shortcuts, including custom playlists", () => {
    state.tracks = tracks;
    state.favorites = [tracks[0].path];
    state.customPlaylists = [{ name: "Gym", tracks: [tracks[1].path] }];
    renderPage(<InicioPage controls={controls} />);
    const shortcuts = screen.getByRole("region", { name: "Accesos directos" });
    fireEvent.click(within(shortcuts).getByRole("button", { name: /Favoritos/ }));
    expect(screen.getByTestId("route")).toHaveTextContent("biblioteca:favoritos");
    fireEvent.click(within(shortcuts).getByRole("button", { name: /Gym/ }));
    expect(screen.getByTestId("route")).toHaveTextContent("biblioteca:playlist");
  });

  it("lists quick picks with favorites first and plays the whole list", () => {
    state.tracks = tracks;
    state.favorites = [tracks[2].path];
    renderPage(<InicioPage controls={controls} />);
    const quick = screen.getByRole("region", { name: "Selecciones rápidas" });
    const titles = within(quick).getAllByRole("button", { name: /^Reproducir (?!todo)/ }).map((button) => button.getAttribute("aria-label"));
    expect(titles[0]).toBe("Reproducir Low Tide");
    fireEvent.click(within(quick).getByRole("button", { name: /Reproducir todo/ }));
    expect(actions.playCollection).toHaveBeenCalledWith([tracks[2], tracks[0], tracks[1]], 0);
    fireEvent.click(within(quick).getByRole("button", { name: "Agregar Blue Hour a favoritos" }));
    expect(actions.toggleFavorite).toHaveBeenCalledWith(tracks[0].path);
  });

  it("shows recently played unique tracks and routes playback by source", () => {
    state.tracks = tracks;
    history.entries = [
      historyEntry({ ...tracks[0], path: "youtube:dQw4w9WgXcQ", album: "YouTube" }, 1, "youtube"),
      historyEntry(tracks[1], 2),
      historyEntry(tracks[1], 3),
      historyEntry({ ...tracks[2], path: "https://radio.example/stream", album: "Internet Radio" }, 4, "radio"),
    ];
    renderPage(<InicioPage controls={controls} />);
    const recent = screen.getByRole("region", { name: "Volver a escuchar" });
    expect(within(recent).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(within(recent).getByRole("button", { name: "Reproducir Blue Hour" }));
    expect(actions.playYouTube).toHaveBeenCalledWith(
      { id: "dQw4w9WgXcQ", title: "Blue Hour", artist: "Northbound", duration: 205, available: true },
      expect.any(Array),
    );
    fireEvent.click(within(recent).getByRole("button", { name: "Reproducir Paper Moons" }));
    expect(actions.playCollection).toHaveBeenCalled();
    fireEvent.click(within(recent).getByRole("button", { name: "Reproducir Low Tide" }));
    expect(actions.playVirtualTrack).toHaveBeenCalled();
  });
});

describe("BuscarPage", () => {
  const search = (text: string) => fireEvent.change(screen.getByLabelText("Buscar música"), { target: { value: text } });

  it("asks for at least two letters before searching", () => {
    renderPage(<BuscarPage controls={controls} />);
    expect(screen.getByText("Escribí al menos dos letras para ver resultados.")).toBeInTheDocument();
    search("b");
    expect(api.youtubeSearch).not.toHaveBeenCalled();
  });

  it("combines local, YouTube and radio results and plays each kind", async () => {
    state.tracks = tracks;
    renderPage(<BuscarPage controls={controls} />);
    search("blue");
    await screen.findByRole("region", { name: "En tu biblioteca" }, { timeout: 3000 });
    const youtube = await screen.findByRole("region", { name: "En YouTube" }, { timeout: 3000 });
    const radio = await screen.findByRole("region", { name: "Radio" }, { timeout: 3000 });
    expect(api.youtubeSearch).toHaveBeenCalledWith("blue", 1);
    expect(within(radio).getByText("Blue Jazz FM")).toBeInTheDocument();
    expect(within(radio).queryByText("Groove Salad")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reproducir Blue Hour" }));
    expect(actions.playCollection).toHaveBeenCalledWith([tracks[0]], 0);
    fireEvent.click(within(youtube).getByRole("button", { name: "Reproducir Blue Hour (Live)" }));
    expect(actions.playYouTube).toHaveBeenCalledWith(expect.objectContaining({ id: "dQw4w9WgXcQ" }), expect.any(Array));
    fireEvent.click(within(radio).getByRole("button", { name: "Reproducir Blue Jazz FM" }));
    expect(actions.playVirtualTrack).toHaveBeenCalledWith(expect.objectContaining({ path: "https://radio.example/jazz" }));
  });

  it("asks for confirmation before downloading a result", async () => {
    renderPage(<BuscarPage controls={controls} />);
    search("blue");
    const youtube = await screen.findByRole("region", { name: "En YouTube" }, { timeout: 3000 });
    fireEvent.click(within(youtube).getByRole("button", { name: "Descargar Blue Hour (Live)" }));
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
    fireEvent.click(within(youtube).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(youtube).getByRole("button", { name: "Descargar Blue Hour (Live)" }));
    fireEvent.click(within(youtube).getByRole("button", { name: "Confirmar descarga" }));
    await waitFor(() => expect(api.youtubeEnqueue).toHaveBeenCalledOnce());
    expect(api.youtubeEnqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "dQw4w9WgXcQ", playlist: false }));
    expect(await screen.findByText(/se agregó a la cola de descargas/)).toBeInTheDocument();
  });

  it("skips YouTube while offline and says so", async () => {
    online.isOnline = false;
    state.tracks = tracks;
    renderPage(<BuscarPage controls={controls} />);
    search("blue");
    await screen.findByRole("region", { name: "En tu biblioteca" }, { timeout: 3000 });
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument();
    expect(api.youtubeSearch).not.toHaveBeenCalled();
  });

  it("reports YouTube failures and shows an empty state when nothing matches", async () => {
    vi.mocked(api.youtubeSearch).mockRejectedValue(new Error("Service unavailable"));
    renderPage(<BuscarPage controls={controls} />);
    search("zzzz");
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("Service unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
  });

  it("inspects a pasted video link by its exact ID instead of searching for the URL", async () => {
    vi.mocked(api.youtubeInspect).mockResolvedValue({
      id: "L50II6zJy9U",
      title: "For Narmer",
      items: [{ id: "L50II6zJy9U", title: "For Narmer", artist: "PlayWarframe", duration: 219, available: true }],
      playlist: false,
    });
    renderPage(<BuscarPage controls={controls} />);
    search("https://www.youtube.com/watch?v=L50II6zJy9U&list=RDL50II6zJy9U&start_radio=1");
    const youtube = await screen.findByRole("region", { name: "En YouTube" }, { timeout: 3000 });
    expect(within(youtube).getByText("For Narmer")).toBeInTheDocument();
    expect(api.youtubeInspect).toHaveBeenCalledWith("https://www.youtube.com/watch?v=L50II6zJy9U", false);
    expect(api.youtubeSearch).not.toHaveBeenCalled();
  });

  it("lists only the available videos of a pasted playlist link", async () => {
    vi.mocked(api.youtubeInspect).mockResolvedValue({
      id: "PLabc123",
      title: "Mix",
      items: [
        { id: "dQw4w9WgXcQ", title: "Song A", artist: "A", duration: 100, available: true },
        { id: "unavailable-1", title: "Unavailable playlist entry", artist: "YouTube", duration: 0, available: false },
      ],
      playlist: true,
    });
    renderPage(<BuscarPage controls={controls} />);
    search("https://www.youtube.com/playlist?list=PLabc123");
    const youtube = await screen.findByRole("region", { name: "En YouTube" }, { timeout: 3000 });
    expect(within(youtube).getByText("Song A")).toBeInTheDocument();
    expect(within(youtube).queryByText("Unavailable playlist entry")).not.toBeInTheDocument();
    expect(api.youtubeInspect).toHaveBeenCalledWith("https://www.youtube.com/playlist?list=PLabc123", true);
    expect(api.youtubeSearch).not.toHaveBeenCalled();
  });

  it("rejects links that are not YouTube videos or playlists without searching for them", async () => {
    renderPage(<BuscarPage controls={controls} />);
    search("https://example.com/watch?v=dQw4w9WgXcQ");
    expect(await screen.findByRole("alert")).toHaveTextContent("Pegá un enlace de video o playlist de YouTube.");
    expect(api.youtubeSearch).not.toHaveBeenCalled();
    expect(api.youtubeInspect).not.toHaveBeenCalled();
  });
});

describe("EstadisticasPage", () => {
  it("shows an empty state without history", () => {
    renderPage(<EstadisticasPage controls={controls} />);
    expect(screen.getByText("Todavía no hay historial")).toBeInTheDocument();
  });

  it("summarizes the selected range and lists the top tracks", () => {
    history.entries = [
      historyEntry(tracks[0], 1),
      historyEntry(tracks[0], 5),
      historyEntry(tracks[1], 30),
      historyEntry(tracks[2], 24 * 20),
    ];
    renderPage(<EstadisticasPage controls={controls} />);
    const summary = screen.getByRole("region", { name: "Resumen" });
    expect(within(summary).getByText("Reproducciones").previousElementSibling).toHaveTextContent("3");
    const top = screen.getByRole("region", { name: "Más escuchadas" });
    expect(within(top).getAllByRole("listitem")[0]).toHaveTextContent("Blue Hour");
    expect(within(top).getAllByRole("listitem")[0]).toHaveTextContent("2 veces");

    fireEvent.click(screen.getByRole("button", { name: "Siempre" }));
    expect(within(summary).getByText("Reproducciones").previousElementSibling).toHaveTextContent("4");
    fireEvent.click(within(top).getAllByRole("button")[0]);
    expect(actions.playCollection).toHaveBeenCalled();
  });

  it("exposes the activity chart as an accessible table", () => {
    history.entries = [historyEntry(tracks[0], 1)];
    renderPage(<EstadisticasPage controls={controls} />);
    expect(screen.getByRole("table", { name: "Reproducciones por día" })).toBeInTheDocument();
  });

  it("clears the history only after confirming", async () => {
    history.entries = [historyEntry(tracks[0], 1)];
    renderPage(<EstadisticasPage controls={controls} />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar historial" }));
    expect(history.clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar historial" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar todo" }));
    await waitFor(() => expect(history.clear).toHaveBeenCalledOnce());
  });
});

describe("ConfiguracionPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("wires the library buttons and shows the current folder", () => {
    renderPage(<ConfiguracionPage controls={controls} />);
    expect(screen.getByText("C:\\Music")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir carpeta" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir archivo" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));
    expect(controls.onSelectFolder).toHaveBeenCalledOnce();
    expect(controls.onOpenFile).toHaveBeenCalledOnce();
    expect(controls.onShowAbout).toHaveBeenCalledOnce();
  });

  it("changes and persists the accent color", () => {
    renderPage(<ConfiguracionPage controls={controls} />);
    const group = screen.getByRole("radiogroup", { name: "Color de acento" });
    expect(within(group).getByRole("radio", { name: "Violeta" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(group).getByRole("radio", { name: "Azul" }));
    expect(within(group).getByRole("radio", { name: "Azul" })).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("flowplayer-accent")).toBe("azul");
  });

  it("persists the start mode", () => {
    renderPage(<ConfiguracionPage controls={controls} />);
    const group = screen.getByRole("radiogroup", { name: "Modo al iniciar" });
    fireEvent.click(within(group).getByRole("radio", { name: /Flow/ }));
    expect(localStorage.getItem("flowplayer-start-mode")).toBe("flow");
    expect(within(group).getByRole("radio", { name: /Flow/ })).toHaveAttribute("aria-checked", "true");
  });

  it("lists the keyboard shortcuts and disables clearing an empty history", () => {
    renderPage(<ConfiguracionPage controls={controls} />);
    expect(screen.getByRole("table", { name: "Atajos de teclado" })).toHaveTextContent("Ctrl+K");
    expect(screen.getByRole("button", { name: "Borrar historial" })).toBeDisabled();
  });
});
