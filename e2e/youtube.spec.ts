import { expect, test, type Page } from "@playwright/test";
import { mockTauri } from "./support/tauri-mock";
import { mockYouTube } from "./support/youtube-mock";

const videos = [
  { id: "aqz-KE-bpKQ", title: "QA Video Alpha", artist: "QA", duration: 120, available: true },
  { id: "YE7VzlLtp-4", title: "QA Video Beta", artist: "QA", duration: 120, available: true },
];

async function search(page: Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("group", { name: "Dónde buscar" }).getByRole("button", { name: "YouTube", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar música" }).fill("QA Video");
  await expect(page.getByRole("button", { name: "Reproducir QA Video Alpha", exact: true })).toBeVisible();
}

async function play(page: Page) {
  await search(page);
  await page.getByRole("button", { name: "Reproducir QA Video Alpha", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.state)).toBe(1);
}

test.beforeEach(async ({ page }) => {
  await mockTauri(page, { responses: { youtube_search: videos, youtube_enqueue: "qa-job" } });
  await mockYouTube(page);
});

test("YouTube simulation: float, dock and undock without recreating the player", async ({ page }) => {
  await play(page);
  const host = page.getByRole("region", { name: "Reproductor oficial de YouTube" });
  await expect(host).toHaveClass(/yt-host--float/);
  const video = await host.locator("iframe").boundingBox();
  expect(video!.width).toBeGreaterThanOrEqual(200);
  expect(video!.height).toBeGreaterThanOrEqual(200);
  await page.getByRole("button", { name: "Abrir Reproduciendo", exact: true }).click();
  await expect(host).toHaveClass(/yt-host--stage/);
  await page.getByRole("button", { name: "Cerrar Reproduciendo", exact: true }).click();
  await expect(host).toHaveClass(/yt-host--float/);
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.created)).toBe(1);
});

test("YouTube simulation: pause, resume, seek, volume and queue controls", async ({ page }) => {
  await play(page);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.state)).toBe(2);
  await page.getByRole("slider", { name: "Posición", exact: true }).fill("50");
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.position)).toBeCloseTo(60, 0);
  await page.getByRole("slider", { name: "Volumen" }).fill("0.3");
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.volume)).toBe(30);
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.state)).toBe(1);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.videoId)).toBe(videos[1].id);
  await page.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.videoId)).toBe(videos[0].id);
  expect(await page.evaluate(() => window.__TAURI_MOCK_CALLS__?.some((call) => call.command === "youtube_enqueue"))).toBe(false);
});

test("YouTube simulation: opens the floating video from Flow without recreating or pausing it", async ({ page }) => {
  await play(page);
  await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Flow", exact: true }).click();
  await expect(page.locator(".flow-view")).toBeVisible();
  await page.getByRole("button", { name: "Abrir Reproduciendo", exact: true }).click();
  await expect(page.locator(".layout")).toHaveClass("layout layout--normal");
  await expect(page.getByRole("region", { name: "Reproductor oficial de YouTube" })).toHaveClass(/yt-host--stage/);
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.created)).toBe(1);
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.state)).toBe(1);
});

test("YouTube simulation: autoplay advances and can be disabled", async ({ page }) => {
  await play(page);
  await page.evaluate(() => window.__YOUTUBE_QA__?.finish());
  await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.videoId)).toBe(videos[1].id);
  await page.getByRole("button", { name: "Abrir Reproduciendo", exact: true }).click();
  await page.getByRole("switch", { name: "Autoplay" }).uncheck();
  await page.evaluate(() => window.__YOUTUBE_QA__?.finish());
  await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.videoId)).toBe(videos[1].id);
});

test("YouTube simulation: embed errors explain the fallback and closing stops playback", async ({ page }) => {
  await play(page);
  await page.evaluate(() => window.__YOUTUBE_QA__?.fail(153));
  await expect(page.getByRole("alert")).toContainText("origen de la aplicación");
  await expect(page.getByRole("button", { name: "Abrir en YouTube", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar reproductor de YouTube", exact: true }).click();
  await expect(page.getByRole("region", { name: "Reproductor oficial de YouTube" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.stopped)).toBe(1);
});

for (const mode of ["Zen", "Mini"]) {
  test(`YouTube simulation: entering ${mode} pauses the video`, async ({ page }) => {
    await play(page);
    await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: mode, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__YOUTUBE_QA__?.state)).toBe(-1);
    await expect(page.getByRole("region", { name: "Reproductor oficial de YouTube" })).toHaveCount(0);
    await page.keyboard.press("Alt+n");
    await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
  });
}

test("YouTube simulation: downloads require confirmation and do not start playback", async ({ page }) => {
  await search(page);
  await page.getByRole("button", { name: "Descargar QA Video Alpha", exact: true }).click();
  expect(await page.evaluate(() => window.__TAURI_MOCK_CALLS__?.filter((call) => call.command === "youtube_enqueue"))).toEqual([]);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirmar descarga", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Descargar QA Video Alpha", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar descarga", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(["se agregó a la cola de descargas", "resultados"]);
  const calls = await page.evaluate(() => window.__TAURI_MOCK_CALLS__?.filter((call) => call.command === "youtube_enqueue"));
  expect(calls).toHaveLength(1);
  expect(calls![0].args).toMatchObject({ collection: { id: videos[0].id, playlist: false } });
  expect(await page.evaluate(() => window.__YOUTUBE_QA__?.created)).toBe(0);
});
