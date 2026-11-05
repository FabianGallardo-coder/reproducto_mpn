import { expect, test } from "@playwright/test";
import { mockTauri, SAMPLE_TRACKS } from "./support/tauri-mock";
import { mockYouTube } from "./support/youtube-mock";

const MOBILE_TRACKS = [
  ...SAMPLE_TRACKS,
  ...Array.from({ length: 120 }, (_, index) => ({
    path: `content://qa/audio/${index}`,
    title: `Pista móvil ${index}`,
    artist: "QA",
    album: "Biblioteca grande",
    duration: 180,
  })),
];

test.use({
  userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
  isMobile: true,
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await mockTauri(page, {
    tracks: MOBILE_TRACKS,
    responses: {
      scan_folder: { tracks: MOBILE_TRACKS, warnings: [] },
      list_radio_stations: [
        { name: "Radio Mitre (790 AM)", genre: "AM Radio", url: "https://example.test/mitre" },
        { name: "Cadena 3 FM (100.5 FM)", genre: "Pop", url: "https://example.test/cadena-fm" },
        { name: "Cadena 3 AM (700 AM)", genre: "AM Radio", url: "https://example.test/cadena-am" },
      ],
    },
  });
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
  await expect(page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Mini", exact: true })).toHaveCount(0);
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

test("Android library scrolls by touch and reaches the last track without expanding every row", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 726 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Biblioteca", exact: true }).tap();
  const list = page.getByRole("listbox", { name: "Lista de canciones" });
  await expect(list.getByRole("option").first()).toBeVisible();
  const box = await list.boundingBox();
  expect(box!.height).toBeGreaterThan(64);
  expect(box!.y + box!.height).toBeLessThanOrEqual((await page.locator(".player-bar").boundingBox())!.y);
  expect(await list.getByRole("option").count()).toBeLessThan(30);
  const session = await page.context().newCDPSession(page);
  try {
    const x = Math.round(box!.x + box!.width / 2);
    const y = Math.round(box!.y + box!.height * 0.8);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 10; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x, y: y - step * 16 }],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(60);
    await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(list.getByRole("option", { name: "Reproducir Pista móvil 119 de QA", exact: true })).toBeInViewport();
  } finally {
    await session.detach();
  }
});

test("Android search finds Mitre and Cadena 3 and respects all source filters", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 726 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Buscar", exact: true }).tap();
  const scopes = page.getByRole("group", { name: "Dónde buscar" });
  const input = page.getByRole("searchbox", { name: "Buscar música" });
  await input.fill("mitre");
  const mitre = page.getByRole("button", { name: "Reproducir Radio Mitre (790 AM)", exact: true });
  await expect(mitre).toBeInViewport();
  await scopes.getByRole("button", { name: "Radio", exact: true }).tap();
  await expect(page.getByLabel("Abrir enlace de YouTube")).toHaveCount(0);
  await expect(mitre).toBeInViewport();
  await input.fill("cadena 3");
  await expect(page.getByRole("button", { name: "Reproducir Cadena 3 FM (100.5 FM)", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reproducir Cadena 3 AM (700 AM)", exact: true })).toBeVisible();
  await scopes.getByRole("button", { name: "Local", exact: true }).tap();
  await expect(page.getByRole("button", { name: /Reproducir Cadena 3/ })).toHaveCount(0);
  await expect(page.getByLabel("Abrir enlace de YouTube")).toHaveCount(0);
  await input.fill("Blue Hour");
  await expect(page.getByRole("button", { name: "Reproducir Blue Hour", exact: true })).toBeVisible();
  await scopes.getByRole("button", { name: "YouTube", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Reproducir Blue Hour", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Abrir enlace de YouTube")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin resultados", exact: true })).toHaveCount(0);
  await scopes.getByRole("button", { name: "Todo", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Reproducir Blue Hour", exact: true })).toBeVisible();
});

test("Android only exposes Normal and Zen and ignores saved Flow and unavailable mode shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 726 });
  await page.addInitScript(() => localStorage.setItem("flowplayer-start-mode", "flow"));
  await page.goto("/");
  await expect(page.locator(".layout--normal")).toBeVisible();
  const modes = page.getByRole("region", { name: "Modos" });
  await expect(modes.getByRole("button", { name: "Normal", exact: true })).toBeVisible();
  await expect(modes.getByRole("button", { name: "Zen", exact: true })).toBeVisible();
  await expect(modes.getByRole("button", { name: /^(Flow|Mini)$/ })).toHaveCount(0);
  await page.keyboard.press("Alt+f");
  await expect(page.locator(".layout--normal")).toBeVisible();
  await page.keyboard.press("Alt+m");
  await expect(page.locator(".layout--normal")).toBeVisible();
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Configuración", exact: true }).tap();
  await expect(page.getByRole("radiogroup", { name: "Modo al iniciar" }).getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /^Normal/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Modos Normal / Flow / Zen / Mini", { exact: true })).toHaveCount(0);
  await modes.getByRole("button", { name: "Zen", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Salir del modo zen" })).toBeVisible();
});
