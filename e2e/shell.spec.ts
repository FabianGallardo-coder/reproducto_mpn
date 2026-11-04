import { expect, test } from "@playwright/test";
import { mockTauri } from "./support/tauri-mock";

test.beforeEach(async ({ page }) => {
  await mockTauri(page);
});

test.describe("app shell", () => {
  test("opens every page from the sidebar without runtime errors", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Secciones" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    for (const name of ["Buscar", "Biblioteca", "Estadísticas", "Configuración", "Inicio"]) {
      await nav.getByRole("button", { name }).click();
      await expect(nav.getByRole("button", { name })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });

  test("places the Modos section below the playlists and switches modes", async ({ page }) => {
    await page.goto("/");
    const playlists = page.getByRole("list", { name: "Playlists" });
    const modes = page.getByRole("region", { name: "Modos" });
    await expect(modes.getByRole("button")).toHaveText(["Normal", "Flow", "Zen", "Mini"]);

    const playlistsBox = await playlists.boundingBox();
    const modesBox = await modes.boundingBox();
    expect(playlistsBox).not.toBeNull();
    expect(modesBox).not.toBeNull();
    expect(modesBox!.y).toBeGreaterThanOrEqual(playlistsBox!.y + playlistsBox!.height - 1);

    await modes.getByRole("button", { name: "Flow" }).click();
    await expect(page.getByRole("complementary", { name: "Navegación principal" })).toHaveClass(/sidebar--collapsed/);
  });

  test("opens the selected page when leaving Flow, including the already selected route", async ({ page }, testInfo) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Secciones" });
    const modes = page.getByRole("region", { name: "Modos" });
    for (const name of ["Inicio", "Buscar", "Biblioteca", "Estadísticas", "Configuración", "Buscar"]) {
      await modes.getByRole("button", { name: "Flow", exact: true }).click();
      await expect(page.locator(".flow-view")).toBeVisible();
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
      await nav.getByRole("button", { name, exact: true }).click();
      await expect(page.locator(".layout")).toHaveClass("layout layout--normal");
      await expect(page.locator(".flow-view")).toHaveCount(0);
      await expect(nav.getByRole("button", { name, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      if (name !== "Inicio") {
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText(name);
      }
    }
    await page.getByRole("searchbox", { name: "Buscar música" }).fill("Blue Hour");
    await expect(page.getByRole("button", { name: "Reproducir Blue Hour", exact: true })).toBeVisible();
    await testInfo.attach("flow-to-search", { body: await page.screenshot(), contentType: "image/png" });
  });

  test("opens Now Playing from Flow without stopping the current track", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Reproducir Blue Hour", exact: true }).click();
    await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Flow", exact: true }).click();
    const callsBefore = await page.evaluate(() => window.__TAURI_MOCK_CALLS__?.length ?? 0);
    await page.getByRole("button", { name: "Abrir Reproduciendo: Blue Hour", exact: true }).click();
    await expect(page.locator(".layout")).toHaveClass("layout layout--normal");
    await expect(page.getByRole("button", { name: "Cerrar Reproduciendo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    const calls = await page.evaluate((start) => window.__TAURI_MOCK_CALLS__?.slice(start), callsBefore);
    expect(calls?.filter(({ command }) => ["pause", "stop", "play_track"].includes(command))).toEqual([]);
  });

  test("collapses the sidebar to an icon rail in Flow mode and in narrow windows", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.getByRole("complementary", { name: "Navegación principal" });
    const wide = await sidebar.boundingBox();
    expect(wide!.width).toBeGreaterThan(200);

    await page.setViewportSize({ width: 800, height: 600 });
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(90);
    await expect(sidebar.getByRole("button", { name: "Biblioteca" })).toBeVisible();
  });

  test("keeps the player bar visible on every page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Configuración" }).click();
    await expect(page.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
  });
});
