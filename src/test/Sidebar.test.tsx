import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = {
  favorites: [] as string[],
  customPlaylists: [] as { name: string; tracks: string[] }[],
};
const mockActions = { createPlaylist: vi.fn().mockResolvedValue(undefined) };

vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => mockState,
  usePlayerActions: () => mockActions,
}));

import { Sidebar } from "../components/layout/Sidebar";
import { NavigationProvider, useNavigation } from "../hooks/useNavigation";

function RouteProbe() {
  const { route, params } = useNavigation();
  return <output data-testid="route">{`${route}:${params.section ?? ""}:${params.playlist ?? ""}`}</output>;
}

function renderSidebar(mode: "normal" | "flow" = "normal", onModeChange = vi.fn()) {
  render(
    <NavigationProvider>
      <Sidebar mode={mode} onModeChange={onModeChange} />
      <RouteProbe />
    </NavigationProvider>,
  );
  return onModeChange;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.favorites = [];
  mockState.customPlaylists = [];
});

describe("Sidebar", () => {
  it("shows the brand and the five page links with the current page marked", () => {
    renderSidebar();
    expect(screen.getByText("FlowPlayer")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect(within(nav).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Inicio",
      "Buscar",
      "Biblioteca",
      "Estadísticas",
      "Configuración",
    ]);
    expect(within(nav).getByRole("button", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates when a page link is clicked", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Estadísticas" }));
    expect(screen.getByTestId("route")).toHaveTextContent("estadisticas");
    expect(screen.getByRole("button", { name: "Estadísticas" })).toHaveAttribute("aria-current", "page");
  });

  it("lists automatic collections with the favorites count", () => {
    mockState.favorites = ["a.mp3", "b.mp3"];
    renderSidebar();
    const list = screen.getByRole("list", { name: "Playlists" });
    expect(within(list).getByText("2 canciones")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: /Favoritos/ }));
    expect(screen.getByTestId("route")).toHaveTextContent("biblioteca:favoritos");
  });

  it("opens custom playlists in the library", () => {
    mockState.customPlaylists = [{ name: "Gym", tracks: ["a.mp3"] }];
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /Gym/ }));
    expect(screen.getByTestId("route")).toHaveTextContent("biblioteca:playlist:Gym");
  });

  it("creates a playlist from the inline form and opens it", async () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Nueva playlist" }));
    const input = screen.getByLabelText("Nombre de la playlist");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "  Road trip  " } });
    fireEvent.submit(input.closest("form")!);
    await vi.waitFor(() => expect(mockActions.createPlaylist).toHaveBeenCalledWith("Road trip"));
    await vi.waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("biblioteca:playlist:Road trip"));
  });

  it("rejects duplicate playlist names and closes the form with Escape", () => {
    mockState.customPlaylists = [{ name: "Gym", tracks: [] }];
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Nueva playlist" }));
    const input = screen.getByLabelText("Nombre de la playlist");
    fireEvent.change(input, { target: { value: "gym" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe una playlist con ese nombre.");
    expect(mockActions.createPlaylist).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("Nombre de la playlist")).not.toBeInTheDocument();
  });

  it("shows the Modos section below the playlists and reports the chosen mode", () => {
    const onModeChange = renderSidebar();
    const playlists = screen.getByRole("list", { name: "Playlists" });
    const modes = screen.getByRole("region", { name: "Modos" });
    expect(playlists.compareDocumentPosition(modes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(modes).getAllByRole("button").map((button) => button.textContent)).toEqual(["Normal", "Flow", "Zen", "Mini"]);
    expect(within(modes).getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(modes).getByRole("button", { name: "Zen" }));
    expect(onModeChange).toHaveBeenCalledWith("zen");
  });

  it("collapses labels to an icon rail in Flow mode but keeps accessible names", () => {
    renderSidebar("flow");
    expect(screen.getByRole("complementary", { name: "Navegación principal" })).toHaveClass("sidebar--collapsed");
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modo Flow" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Nombre de la playlist")).not.toBeInTheDocument();
  });
});
