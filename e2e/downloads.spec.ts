import { expect, test, type Page } from "@playwright/test";
import { mockTauri } from "./support/tauri-mock";
import type { YouTubeLibrary } from "../src/types/youtube";

const alpha = { id: "aqz-KE-bpKQ", title: "QA Download Alpha", artist: "QA", duration: 120, available: true };
const beta = { id: "YE7VzlLtp-4", title: "QA Download Beta", artist: "QA", duration: 120, available: true };
const catalog: YouTubeLibrary = {
  version: 1,
  songs: [
    { ...alpha, path: "C:\\QA\\Alpha.wav", missing: false },
    { ...beta, path: "C:\\QA\\Beta.wav", missing: true },
  ],
  playlists: [{ id: "QA-list", title: "QA Download Mix", items: [alpha, beta, alpha], playlist: true }],
  jobs: [],
};

async function downloads(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Descargas de YouTube", exact: true }).click();
}

test("downloads simulation: offline files dispatch local playback, missing files stay disabled", async ({ page }) => {
  await mockTauri(page, { responses: { youtube_library: catalog } });
  await downloads(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByRole("button", { name: "Reproducir QA Download Beta", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reproducir QA Download Alpha", exact: true }).click();
  const calls = await page.evaluate(() => window.__TAURI_MOCK_CALLS__);
  expect(calls?.find((call) => call.command === "set_playlist")?.args).toMatchObject({
    index: 0, tracks: [{ path: "C:\\QA\\Alpha.wav", title: alpha.title }],
  });
  expect(calls?.some((call) => call.command === "youtube_search" || call.command === "youtube_enqueue")).toBe(false);
});

test("downloads simulation: repeated playlist items retain their queue position", async ({ page }) => {
  await mockTauri(page, { responses: { youtube_library: catalog } });
  await downloads(page);
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: /QA Download Mix/ }).click();
  await expect(page.getByRole("button", { name: /2\. QA Download Beta/ })).toBeDisabled();
  await page.getByRole("button", { name: /3\. QA Download Alpha/ }).click();
  const call = await page.evaluate(() => window.__TAURI_MOCK_CALLS__?.find((entry) => entry.command === "set_playlist"));
  expect(call?.args).toMatchObject({ index: 1, tracks: [{ title: alpha.title }, { title: alpha.title }] });
});

test("downloads simulation: progress, cancellation and retry target the correct job", async ({ page }) => {
  await mockTauri(page, { responses: { youtube_library: {
    ...catalog,
    jobs: [
      { id: "active-job", title: "QA Active", entries: [{ item: alpha, status: "downloading", progress: 35, error: null }] },
      { id: "failed-job", title: "QA Failed", entries: [{ item: beta, status: "failed", progress: 0, error: "QA network failure" }] },
    ],
  } } });
  await downloads(page);
  await expect(page.getByRole("progressbar", { name: `Descargando ${alpha.title}` })).toHaveAttribute("value", "35");
  await expect(page.getByText(`${beta.title}: QA network failure`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar descarga", exact: true }).click();
  await page.getByRole("button", { name: "Reintentar fallidos", exact: true }).click();
  const calls = await page.evaluate(() => window.__TAURI_MOCK_CALLS__);
  expect(calls?.filter((call) => call.command === "youtube_cancel")).toMatchObject([{ args: { id: "active-job" } }]);
  expect(calls?.filter((call) => call.command === "youtube_retry")).toMatchObject([{ args: { id: "failed-job" } }]);
  expect(calls?.some((call) => call.command === "set_playlist")).toBe(false);
});

test("downloads simulation: search failures remain explicit and preserve the query", async ({ page }) => {
  await mockTauri(page, { failures: { youtube_search: "QA service unavailable" } });
  await downloads(page);
  await page.getByRole("button", { name: "Agregar de YouTube", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "Buscar online en YouTube o pegar enlace" });
  await input.fill("QA missing service");
  await page.getByRole("button", { name: "Buscar / inspeccionar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("QA service unavailable");
  await expect(input).toHaveValue("QA missing service");
  await expect(page.getByRole("button", { name: "Buscar / inspeccionar", exact: true })).toBeEnabled();
});
