import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPanel } from "../components/FavoritesPanel";
import { api } from "../lib/api";
import type { Track } from "../types";
const mocks = vi.hoisted(() => ({ favorites: [] as string[], tracks: [] as Track[], play: vi.fn(), remove: vi.fn() }));
vi.mock("../hooks/usePlayerStore", () => ({
  usePlayerState: () => ({ favorites: mocks.favorites, tracks: mocks.tracks, currentTrack: null }),
  usePlayerActions: () => ({ playCollection: mocks.play, toggleFavorite: mocks.remove }),
}));
vi.mock("../lib/api", () => ({ api: { getTrackInfo: vi.fn() } }));
const first: Track = { path: "C:\\other\\first.mp3", title: "First song", artist: "Author", album: "Album", duration: 30 };
beforeEach(() => {
  vi.clearAllMocks(); mocks.favorites = []; mocks.tracks = [];
  vi.mocked(api.getTrackInfo).mockResolvedValue(first);
});
describe("FavoritesPanel", () => {
  it("explains how to add favorites when none exist", async () => {
    render(<FavoritesPanel query="" />);
    expect(await screen.findByText(/Marcá canciones con el corazón/)).toBeVisible();
    expect(api.getTrackInfo).not.toHaveBeenCalled();
  });
  it("resolves favorites outside the folder and plays the favorites collection", async () => {
    mocks.favorites = [first.path];
    render(<FavoritesPanel query="author" />);
    fireEvent.click(await screen.findByRole("button", { name: /First songAuthor/ }));
    expect(mocks.play).toHaveBeenCalledWith([first], 0);
    expect(api.getTrackInfo).toHaveBeenCalledWith(first.path);
    fireEvent.click(screen.getByLabelText("Quitar First song de favoritos"));
    expect(mocks.remove).toHaveBeenCalledWith(first.path);
  });
  it("differentiates empty search results from no favorites", async () => {
    mocks.favorites = [first.path];
    render(<FavoritesPanel query="not found" />);
    expect(await screen.findByText(/No hay favoritos que coincidan/)).toBeVisible();
    expect(screen.queryByText(/Marcá canciones/)).not.toBeInTheDocument();
    expect(mocks.play).not.toHaveBeenCalled();
  });
  it("keeps unavailable favorites visible and removable but not playable", async () => {
    mocks.favorites = [first.path];
    vi.mocked(api.getTrackInfo).mockRejectedValue(new Error("File not found"));
    render(<FavoritesPanel query="" />);
    expect(await screen.findByRole("button", { name: /first.mp3Archivo no disponible/ })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Quitar first.mp3 de favoritos"));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(first.path));
    expect(mocks.play).not.toHaveBeenCalled();
  });
});
