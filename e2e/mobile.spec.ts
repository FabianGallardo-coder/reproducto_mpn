import { expect, test } from "@playwright/test";
import { mockTauri, SAMPLE_TRACKS } from "./support/tauri-mock";
import { mockYouTube } from "./support/youtube-mock";

test.use({
  userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
  isMobile: true,
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await mockTauri(page, { responses: { scan_folder: { tracks: SAMPLE_TRACKS, warnings: [] } } });
  await mockYouTube(page);
  await page.addInitScript(() => {
    Object.assign(window, { isTauri: true });
    const bridge = window.__TAURI_INTERNALS__;
    if (!bridge) throw new Error("Missing QA IPC bridge");
    const original = bridge.invoke;
    bridge.invoke = <T>(command: string, args?: Record<string, unknown>) => {
      if (command !== "mobile_command") return original<T>(command, args);
      const request = args as { command: string; args: Record<string, unknown> };
      return original<T>(request.command, request.args);
    };
  });
});

for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 726 }, { width: 430, height: 932 }, { width: 800, height: 360 }]) {
  test(`Android pages fit ${viewport.width}x${viewport.height} without clipped content or transport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('html[data-platform="android"]')).toHaveCount(1);
    for (const name of ["Inicio", "Buscar", "Biblioteca", "Estadísticas", "Configuración"]) {
      await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.locator("main").evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${name}: main overflow`).toBe(true);
      expect(await page.locator(".page").evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${name}: page overflow`).toBe(true);
      const player = await page.locator(".player-bar").boundingBox();
      expect(player).not.toBeNull();
      expect(player!.y + player!.height).toBeLessThanOrEqual(viewport.height + 1);
      for (const label of ["Anterior", "Reproducir", "Siguiente", "Aleatorio"]) {
        const button = page.locator(".player-bar").getByRole("button", { name: label, exact: true });
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });
}

test("Android exposes playlist form, scrollable Now Playing tabs and persistent touch-only Zen controls", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 726 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nueva playlist", exact: true }).click();
  await expect(page.getByLabel("Nombre de la playlist")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear playlist", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByLabel("Nombre de la playlist")).toHaveCount(0);
  await page.getByRole("button", { name: "Reproducir Blue Hour", exact: true }).click();
  await page.getByRole("button", { name: "Abrir Reproduciendo: Blue Hour", exact: true }).click();
  await expect(page.locator(".nowplaying__title")).toHaveText("Blue Hour");
  expect(await page.locator(".nowplaying").evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  for (const name of ["Cola", "Letra", "Detalles"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toBeInViewport();
  }
  await page.getByRole("button", { name: "Cerrar Reproduciendo", exact: true }).click();
  await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Zen", exact: true }).click();
  const exit = page.getByRole("button", { name: "Salir del modo zen" });
  await expect(exit).toHaveCSS("pointer-events", "auto");
  await expect(exit).toHaveCSS("opacity", "0.8");
  await page.waitForTimeout(3200);
  await expect(exit).toHaveCSS("pointer-events", "auto");
  await exit.tap();
  await expect(page.locator(".layout--normal")).toBeVisible();
  await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Mini", exact: true }).click();
  const mini = await page.locator(".mini-view__card").boundingBox();
  expect(mini!.height).toBeLessThan(400);
  await page.getByRole("button", { name: "Expandir", exact: true }).tap();
  await expect(page.locator(".layout--normal")).toBeVisible();
});

test("Android search does not summon the keyboard on entry and keeps the official player above transport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 726 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByLabel("Buscar música", { exact: true })).not.toBeFocused();
  await page.getByLabel("Abrir enlace de YouTube").fill("https://youtu.be/aqz-KE-bpKQ");
  await page.getByRole("button", { name: "Reproducir video", exact: true }).click();
  const frame = page.locator(".yt-host iframe");
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(200);
  expect(box!.height).toBeGreaterThanOrEqual(200);
  const transport = await page.locator(".player-bar").boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(transport!.y);
});
