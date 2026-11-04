import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RadioPanel } from "../components/RadioPanel";
import { PlayerProvider } from "../hooks/usePlayerStore";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    listRadioStations: vi.fn(),
    getConfig: vi.fn().mockResolvedValue({ favorites: [], custom_radio_stations: [], custom_playlists: [] }),
    setConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

const mockStations = [
  { name: "SomaFM Groove", genre: "Electronic", url: "http://stream1", description: "Groove radio" },
  { name: "SomaFM DEF CON", genre: "Hacker", url: "http://stream2", description: "DEF CON" },
];

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
  vi.mocked(api.listRadioStations).mockClear();
  vi.mocked(api.listRadioStations).mockResolvedValue(mockStations);
});

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
});

describe("RadioPanel", () => {
  const renderWithProvider = (ui: React.ReactElement) => render(ui, { wrapper: PlayerProvider });
  it("filters station names and genres without changing playback", async () => {
    const play = vi.fn();
    const { rerender } = renderWithProvider(<RadioPanel onPlay={play} query="groove" />);
    expect(await screen.findByText("SomaFM Groove")).toBeVisible();
    expect(screen.queryByText("SomaFM DEF CON")).not.toBeInTheDocument();
    rerender(<RadioPanel onPlay={play} query="hacker" />);
    expect(screen.getByText("SomaFM DEF CON")).toBeVisible();
    expect(screen.queryByText("SomaFM Groove")).not.toBeInTheDocument();
    rerender(<RadioPanel onPlay={play} query="missing" />);
    expect(screen.getByText(/No hay emisoras que coincidan/)).toBeVisible();
    expect(play).not.toHaveBeenCalled();
  });

  it("shows loading state initially", () => {
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);
    expect(screen.getByText("Cargando emisoras…")).toBeInTheDocument();
  });

  it("renders stations after load", async () => {
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("SomaFM Groove")).toBeInTheDocument();
    });
    expect(screen.getByText("SomaFM DEF CON")).toBeInTheDocument();
    expect(screen.getByText("Radio")).toBeInTheDocument();
  });

  it("calls onPlay with station url", async () => {
    const onPlay = vi.fn();
    renderWithProvider(<RadioPanel onPlay={onPlay} />);
    await waitFor(() => screen.getByText("SomaFM Groove"));
    screen.getByText("SomaFM Groove").click();
    expect(onPlay).toHaveBeenCalledWith({
      path: "http://stream1",
      title: "SomaFM Groove",
      artist: "Electronic",
      album: "Internet Radio",
      duration: 0,
    });
  });

  it("displays genre for each station", async () => {
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Electronic")).toBeInTheDocument();
    });
    expect(screen.getByText("Hacker")).toBeInTheDocument();
  });

  it("handles empty stations list", async () => {
    vi.mocked(api.listRadioStations).mockResolvedValue([]);
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Todavía no hay emisoras. Agregá una para empezar.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toHaveTextContent("+ Agregar");
  });

  it("disables stations and shows banner when offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sin conexión: las emisoras no están disponibles.",
    );
    const stationButton = screen.getByRole("button", { name: "Reproducir radio SomaFM Groove" });
    expect(stationButton).toBeDisabled();
    expect(stationButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "+ Agregar" })).toBeEnabled();
  });

  it("restores station availability after the browser reports an online transition", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);

    const stationButton = await screen.findByRole("button", { name: "Reproducir radio SomaFM Groove" });
    expect(stationButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/sin conexión/i);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(stationButton).toBeEnabled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a concrete error state when loading radio stations fails", async () => {
    vi.mocked(api.listRadioStations).mockRejectedValue(new Error("radio service unavailable"));

    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);

    expect(await screen.findByText("No se pudieron cargar las emisoras")).toBeInTheDocument();
    expect(screen.queryByText("SomaFM Groove")).not.toBeInTheDocument();
    expect(api.listRadioStations).toHaveBeenCalledOnce();
  });

  it("announces a station refresh failure and keeps the add form available", async () => {
    vi.mocked(api.listRadioStations)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("radio refresh unavailable"));
    renderWithProvider(<RadioPanel onPlay={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "+ Agregar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre de la emisora" }), {
      target: { value: "Night Drive" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "URL de la transmisión" }), {
      target: { value: "https://radio.example/stream" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar emisora" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo agregar la emisora:");
    expect(alert).toHaveTextContent("radio refresh unavailable");
    expect(screen.getByRole("textbox", { name: "Nombre de la emisora" })).toHaveValue("Night Drive");
    expect(screen.getByRole("textbox", { name: "URL de la transmisión" })).toHaveValue(
      "https://radio.example/stream",
    );
    expect(screen.getByRole("button", { name: "Guardar emisora" })).toBeInTheDocument();
    expect(api.listRadioStations).toHaveBeenCalledTimes(2);
  });
});
