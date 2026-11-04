import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";

const platform = vi.hoisted(() => ({ isAndroid: true, invoke: vi.fn() }));
vi.mock("../lib/platform", () => platform);
vi.mock("@tauri-apps/api/core", () => ({
  Channel: class { onmessage?: unknown; },
}));

const track = { path: "content://qa/valid.wav", title: "QA", artist: "QA", album: "", duration: 120 };

beforeEach(() => {
  vi.resetAllMocks();
  platform.isAndroid = true;
});

describe("scanFolder", () => {
  it("keeps valid Android tracks and reports unreadable documents", async () => {
    const warnings = ['No se pudo leer "Broken.wav"'];
    platform.invoke.mockResolvedValue({ tracks: [track], warnings });
    const onWarnings = vi.fn();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await api.scanFolder("content://qa", undefined, onWarnings)).toEqual([track]);
      expect(onWarnings).toHaveBeenCalledExactlyOnceWith(warnings);
      expect(platform.invoke).toHaveBeenCalledWith("scan_folder", { path: "content://qa" });
      expect(log).toHaveBeenCalledWith("[ipc] scan_folder skipped audio documents", warnings);
    } finally { log.mockRestore(); }
  });

  it("returns an empty library with warnings when all Android documents fail", async () => {
    const warnings = ["Audio no compatible"];
    platform.invoke.mockResolvedValue({ tracks: [], warnings });
    const onWarnings = vi.fn();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await api.scanFolder("content://qa", undefined, onWarnings)).toEqual([]);
      expect(onWarnings).toHaveBeenCalledExactlyOnceWith(warnings);
    } finally { log.mockRestore(); }
  });

  it("does not warn for a successful Android scan", async () => {
    platform.invoke.mockResolvedValue({ tracks: [track], warnings: [] });
    const onWarnings = vi.fn();
    expect(await api.scanFolder("content://qa", undefined, onWarnings)).toEqual([track]);
    expect(onWarnings).not.toHaveBeenCalled();
  });

  it("preserves folder permission failures instead of returning a successful empty library", async () => {
    platform.invoke.mockRejectedValue(new Error("El permiso de la carpeta fue revocado"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(api.scanFolder("content://qa")).rejects.toThrow("El permiso de la carpeta fue revocado");
    } finally { log.mockRestore(); }
  });

  it("preserves the desktop array and progress channel contract", async () => {
    platform.isAndroid = false;
    platform.invoke.mockResolvedValue([track]);
    const progress = vi.fn();
    const onWarnings = vi.fn();
    expect(await api.scanFolder("C:\\QA", progress, onWarnings)).toEqual([track]);
    expect(platform.invoke).toHaveBeenCalledWith("scan_folder", {
      path: "C:\\QA", onProgress: expect.objectContaining({ onmessage: progress }),
    });
    expect(onWarnings).not.toHaveBeenCalled();
  });
});
