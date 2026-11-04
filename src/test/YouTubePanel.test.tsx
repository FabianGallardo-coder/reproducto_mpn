import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubePanel } from "../components/YouTubePanel";
import { api } from "../lib/api";
import type { YouTubeLibrary, YouTubeCollection } from "../types/youtube";

const mocks = vi.hoisted(() => ({ play: vi.fn(), playYouTube: vi.fn(), online: true }));
vi.mock("../hooks/usePlayerStore", () => ({ usePlayerActions: () => ({ playCollection: mocks.play, playYouTube: mocks.playYouTube }) }));
vi.mock("../hooks/useOnlineStatus", () => ({ useOnlineStatus: () => ({ isOnline: mocks.online }) }));
vi.mock("../lib/api", () => ({ api: {
  youtubeLibrary: vi.fn(), youtubeSearch: vi.fn(), youtubeInspect: vi.fn(),
  youtubeEnqueue: vi.fn(), youtubeCancel: vi.fn(), youtubeRetry: vi.fn(),
} }));
const item = { id: "abc123", title: "Blue Hour", artist: "Northbound", duration: 205, available: true };
const collection: YouTubeCollection = { id: "PL_demo", title: "Evening playlist", playlist: true, items: [item] };
let library: YouTubeLibrary;
beforeEach(() => {
  vi.clearAllMocks(); mocks.online = true;
  library = { version: 1, songs: [{ ...item, path: "C:\\data\\abc123.m4a", missing: false }], playlists: [collection], jobs: [] };
  vi.mocked(api.youtubeLibrary).mockImplementation(async () => structuredClone(library));
  vi.mocked(api.youtubeInspect).mockResolvedValue(collection);
  vi.mocked(api.youtubeSearch).mockResolvedValue([item]);
  vi.mocked(api.youtubeEnqueue).mockResolvedValue("PL_demo");
});
describe("YouTubePanel", () => {
  it("searches local downloads and plays offline without online lookup", async () => {
    mocks.online = false;
    const { rerender } = render(<YouTubePanel query="north" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reproducir Blue Hour" }));
    expect(mocks.play).toHaveBeenCalledWith([{ path: "C:\\data\\abc123.m4a", title: "Blue Hour", artist: "Northbound", album: "YouTube", duration: 205 }], 0);
    expect(api.youtubeSearch).not.toHaveBeenCalled();
    rerender(<YouTubePanel query="not present" />);
    expect(screen.getByText("No hay descargas que coincidan.")).toBeVisible();
  });
  it("confirms inspected playlist before enqueue and never auto plays downloads", async () => {
    render(<YouTubePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar de YouTube" }));
    fireEvent.change(screen.getByLabelText("Buscar online en YouTube o pegar enlace"), { target: { value: "https://youtube.com/playlist?list=PL_demo" } });
    fireEvent.click(screen.getByLabelText("Incluir playlist del enlace"));
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    expect(await screen.findByLabelText("Confirmar descarga")).toHaveTextContent("1 canciones");
    expect(api.youtubeInspect).toHaveBeenCalledWith("https://youtube.com/playlist?list=PL_demo", true);
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar descarga" }));
    await waitFor(() => expect(api.youtubeEnqueue).toHaveBeenCalledWith(collection));
    expect(mocks.play).not.toHaveBeenCalled();
  });
  it("searches online text separately and selects a song for confirmation", async () => {
    render(<YouTubePanel query="local filter" />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar de YouTube" }));
    fireEvent.change(screen.getByLabelText("Buscar online en YouTube o pegar enlace"), { target: { value: "blue live" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descargar Blue Hour" }));
    expect(api.youtubeSearch).toHaveBeenCalledWith("blue live", 1);
    expect(screen.getByLabelText("Confirmar descarga")).toHaveTextContent("Blue Hour");
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
  });
  it("plays online results through the official player without downloading", async () => {
    const video = { ...item, id: "dQw4w9WgXcQ" };
    vi.mocked(api.youtubeSearch).mockResolvedValue([video]);
    render(<YouTubePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar de YouTube" }));
    fireEvent.change(screen.getByLabelText("Buscar online en YouTube o pegar enlace"), { target: { value: "blue live" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reproducir Blue Hour en YouTube" }));

    expect(mocks.playYouTube).toHaveBeenCalledWith(video, [video]);
    expect(screen.queryByTitle(/Reproductor oficial de YouTube/)).not.toBeInTheDocument();
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
  });
  it("does not poll the library while no download is running", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout"] });
    try {
      render(<YouTubePanel />);
      await vi.waitFor(() => expect(api.youtubeLibrary).toHaveBeenCalledTimes(1));
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(api.youtubeLibrary).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("polls progress only while a download is active", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout"] });
    try {
      library.jobs = [{ id: "active", title: "Active job", entries: [{ item, status: "downloading", progress: 30, error: null }] }];
      render(<YouTubePanel />);
      await vi.waitFor(() => expect(api.youtubeLibrary).toHaveBeenCalledTimes(1));
      await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
      expect(vi.mocked(api.youtubeLibrary).mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("reports online failure and permits retry without losing input", async () => {
    vi.mocked(api.youtubeSearch).mockRejectedValueOnce(new Error("Service unavailable"));
    render(<YouTubePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar de YouTube" }));
    const input = screen.getByLabelText("Buscar online en YouTube o pegar enlace");
    fireEvent.change(input, { target: { value: "live" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(input).toHaveValue("live");
    expect(screen.getByRole("button", { name: "Buscar / inspeccionar" })).toBeEnabled();
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
  });
  it("clears the previous confirmation when starting a different online search", async () => {
    render(<YouTubePanel />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar de YouTube" }));
    const input = screen.getByLabelText("Buscar online en YouTube o pegar enlace");
    fireEvent.change(input, { target: { value: "https://youtube.com/watch?v=abc123" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    await screen.findByLabelText("Confirmar descarga");
    fireEvent.change(input, { target: { value: "another search" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar / inspeccionar" }));
    await screen.findByRole("button", { name: "Descargar Blue Hour" });
    expect(screen.queryByLabelText("Confirmar descarga")).not.toBeInTheDocument();
    expect(api.youtubeEnqueue).not.toHaveBeenCalled();
  });
  it("plays the ordered downloaded playlist without replacing it with search results", async () => {
    render(<YouTubePanel />);
    await screen.findByRole("button", { name: "Reproducir Blue Hour" });
    fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
    fireEvent.click(screen.getByRole("button", { name: /Evening playlist/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reproducir playlist" }));
    expect(mocks.play).toHaveBeenCalledWith([expect.objectContaining({ title: "Blue Hour" })], 0);
  });
  it("plays a repeated playlist item at its selected position", async () => {
    const second = { ...item, id: "second", title: "Second song" };
    library.songs.push({ ...second, path: "C:\\data\\second.m4a", missing: false });
    library.playlists[0].items = [item, second, item];
    render(<YouTubePanel />);
    await screen.findByRole("button", { name: "Reproducir Blue Hour" });
    fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
    fireEvent.click(screen.getByRole("button", { name: /Evening playlist/ }));
    fireEvent.click(screen.getByRole("button", { name: /^3\. Blue Hour/ }));
    expect(mocks.play).toHaveBeenCalledWith([
      expect.objectContaining({ path: "C:\\data\\abc123.m4a" }),
      expect.objectContaining({ path: "C:\\data\\second.m4a" }),
      expect.objectContaining({ path: "C:\\data\\abc123.m4a" }),
    ], 2);
  });
  it("cancels active jobs and retries failed jobs without playing", async () => {
    library.jobs = [
      { id: "active", title: "Active job", entries: [{ item, status: "downloading", progress: 30, error: null }] },
      { id: "failed", title: "Failed job", entries: [{ item, status: "failed", progress: 0, error: "Network lost" }] },
    ];
    render(<YouTubePanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar descarga" }));
    await waitFor(() => expect(api.youtubeCancel).toHaveBeenCalledWith("active"));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar fallidos" }));
    await waitFor(() => expect(api.youtubeRetry).toHaveBeenCalledWith("failed"));
    expect(mocks.play).not.toHaveBeenCalled();
  });
  it("disables missing downloads and explains an empty local library", async () => {
    library.songs[0].missing = true;
    const { unmount } = render(<YouTubePanel />);
    expect(await screen.findByRole("button", { name: "Reproducir Blue Hour" })).toBeDisabled();
    unmount(); library.songs = [];
    render(<YouTubePanel />);
    expect(await screen.findByText(/Todavía no hay canciones descargadas/)).toBeVisible();
  });
});
