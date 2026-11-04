import { test, expect, capture, ipc, library, navigate } from "./fixtures";

test.beforeEach(() => {
  test.skip(process.env.FLOWPLAYER_QA_ONLINE !== "1", "Set FLOWPLAYER_QA_ONLINE=1 to contact YouTube and live radio.");
});

test("online: real YouTube search returns playable results", async ({ app }) => {
  test.setTimeout(120_000);
  await navigate(app, "Buscar");
  await app.getByRole("group", { name: "Dónde buscar" }).getByRole("button", { name: "YouTube", exact: true }).click();
  await app.getByRole("searchbox", { name: "Buscar música" }).fill("Blender Open Movie Big Buck Bunny");
  await expect(app.getByRole("region", { name: "En YouTube" }).getByRole("button", { name: /^Reproducir / }).first())
    .toBeVisible({ timeout: 90_000 });
});

test("online: official YouTube iframe plays and responds in real WebView2", async ({ app }, testInfo) => {
  test.setTimeout(120_000);
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Descargas de YouTube", exact: true }).click();
  await app.getByRole("button", { name: "Agregar de YouTube", exact: true }).click();
  // Blender's public open movie; inspecting/playing never enqueues a download.
  await app.getByRole("searchbox", { name: "Buscar online en YouTube o pegar enlace" })
    .fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
  await app.getByRole("button", { name: "Buscar / inspeccionar", exact: true }).click();
  await app.getByRole("button", { name: "Reproducir en FlowPlayer", exact: true }).click({ timeout: 90_000 });
  const host = app.getByRole("region", { name: "Reproductor oficial de YouTube" });
  await expect(host.locator("iframe")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => Number(await app.getByRole("slider", { name: "Posición", exact: true }).inputValue()),
    { timeout: 30_000, message: "Actual YouTube playback must advance, not just show an iframe." }).toBeGreaterThan(0);
  await expect(host.getByRole("alert")).toHaveCount(0);
  await capture(app, testInfo, "youtube-floating");
  const seek = app.getByRole("slider", { name: "Posición", exact: true });
  await seek.fill("10");
  // Wait beyond the optimistic UI update and require progress reported back by YouTube.
  await expect.poll(async () => Number(await seek.inputValue()), { timeout: 15_000 }).toBeGreaterThan(10.02);
  await app.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(app.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
  await app.waitForTimeout(700);
  const paused = Number(await seek.inputValue());
  await app.waitForTimeout(700);
  expect(Math.abs(Number(await seek.inputValue()) - paused)).toBeLessThan(0.1);
  await app.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(async () => Number(await seek.inputValue()), { timeout: 15_000 }).toBeGreaterThan(paused + 0.02);
  await app.getByRole("button", { name: "Abrir Reproduciendo", exact: true }).click();
  await expect(host).toHaveClass(/yt-host--stage/);
  await capture(app, testInfo, "youtube-docked");
  await app.getByRole("button", { name: "Cerrar Reproduciendo", exact: true }).click();
  await expect(host).toHaveClass(/yt-host--float/);
  await app.getByRole("button", { name: "Cerrar reproductor de YouTube", exact: true }).click();
});

test("online: a preset radio station produces real playback", async ({ app }) => {
  test.setTimeout(90_000);
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Radio", exact: true }).click();
  await app.getByRole("button", { name: /Reproducir radio/ }).first().click();
  await expect.poll(async () => {
    const state = await ipc<{ playing: boolean; position: number }>(app, "get_state");
    return state.playing && state.position > 0;
  }, { timeout: 60_000 }).toBe(true);
});
