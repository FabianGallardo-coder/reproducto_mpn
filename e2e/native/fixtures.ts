import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import type { AppConfig, PlaybackState, Track } from "../../src/types";
import type { PlayHistoryEntry } from "../../src/types/history";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
  }
}

export function ipc<T>(page: Page, command: string, args?: Record<string, unknown>): Promise<T> {
  return page.evaluate(({ command, args }) => {
    if (!window.__TAURI_INTERNALS__) throw new Error("Native Tauri IPC is unavailable.");
    return window.__TAURI_INTERNALS__.invoke<T>(command, args);
  }, { command, args });
}

export const playback = (page: Page) => ipc<PlaybackState>(page, "get_state");
export const config = (page: Page) => ipc<AppConfig>(page, "get_config");
export const history = (page: Page) => ipc<PlayHistoryEntry[]>(page, "get_history");

export async function capture(page: Page, testInfo: TestInfo, name: string) {
  const image = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await testInfo.attach(name, { body: image, contentType: "image/png" });
}

export async function navigate(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
}

export async function library(page: Page) {
  await navigate(page, "Biblioteca");
  await page.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Pistas locales" }).click();
}

export async function playFirst(page: Page) {
  await library(page);
  await page.getByRole("option", { name: /Reproducir QA Alpha de/ }).click();
  await expect.poll(async () => (await playback(page)).playing).toBe(true);
  await expect(page.getByRole("button", { name: "Abrir Reproduciendo: QA Alpha", exact: true })).toBeVisible();
}

// Original silent PCM audio: no network downloads or copyrighted test media.
function silentWav(seconds: number): Buffer {
  const sampleRate = 8_000;
  const dataLength = seconds * sampleRate * 2;
  const wav = Buffer.alloc(44 + dataLength);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataLength, 40);
  return wav;
}

export const test = base.extend<{ app: Page; tracks: Track[] }, { nativePage: Page; musicFolder: string }>({
  nativePage: [async ({ playwright }, use) => {
    const endpoint = process.env.FLOWPLAYER_QA_CDP ?? "http://127.0.0.1:9223";
    const url = new URL(endpoint);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      throw new Error("Native QA only permits a loopback WebView2 endpoint.");
    }
    const browser = await playwright.chromium.connectOverCDP(endpoint);
    try {
      const page = browser.contexts().flatMap((context) => context.pages())
        .find((candidate) => candidate.url().startsWith("http://127.0.0.1:52000"));
      if (!page) throw new Error("Start the native QA app on port 52000 before running this suite.");
      const identifier = await ipc<string>(page, "plugin:app|identifier");
      if (identifier !== "com.flowplayer.qa") {
        throw new Error(`Refusing to modify non-QA profile: ${identifier}`);
      }
      await use(page);
    } finally {
      await browser.close();
    }
  }, { scope: "worker" }],

  musicFolder: [async ({}, use, workerInfo) => {
    const folder = path.resolve(workerInfo.project.outputDir, "audio-fixtures");
    await mkdir(folder, { recursive: true });
    for (const name of ["QA Alpha", "QA Beta", "QA Gamma"]) {
      await writeFile(path.join(folder, `${name}.wav`), silentWav(120));
    }
    await use(folder);
  }, { scope: "worker" }],

  app: async ({ nativePage: page, musicFolder }, use, testInfo) => {
    const errors: string[] = [];
    const onError = (error: Error) => errors.push(error.message);
    page.on("pageerror", onError);
    await ipc(page, "pause");
    await ipc(page, "set_config", {
      config: {
        music_folder: musicFolder, volume: 0.05, shuffle: false, repeat: "off",
        last_track_index: null, last_position: 0, favorites: [],
        custom_playlists: [], custom_radio_stations: [],
      } satisfies AppConfig,
    });
    await ipc(page, "clear_history");
    await page.evaluate(() => {
      for (const key of ["flowplayer-accent", "flowplayer-start-mode", "flowplayer-autoplay"]) {
        localStorage.removeItem(key);
      }
    });
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
    await expect(page.locator(".home__grid .media-row")).toHaveCount(3);
    try {
      await use(page);
    } finally {
      await capture(page, testInfo, "native");
      await ipc(page, "pause");
      // Restore native geometry through the UI as well as Rust.
      await page.keyboard.press("Alt+n");
      await expect(page.locator(".layout--normal")).toBeVisible();
      await ipc(page, "set_window_mode", { mode: "normal" });
      page.off("pageerror", onError);
      await testInfo.attach("runtime-errors", { body: JSON.stringify(errors), contentType: "application/json" });
      expect(errors, "Uncaught errors in the native WebView").toEqual([]);
    }
  },

  tracks: async ({ app, musicFolder }, use) => {
    const tracks = await Promise.all(["QA Alpha", "QA Beta", "QA Gamma"].map((name) =>
      ipc<Track>(app, "get_track_info", { path: path.join(musicFolder, `${name}.wav`) })));
    await use(tracks.sort((a, b) => a.title.localeCompare(b.title)));
  },
});

export { expect };
