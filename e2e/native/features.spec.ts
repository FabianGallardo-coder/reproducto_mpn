import { test, expect, capture, config, history, ipc, library, navigate, playback, playFirst } from "./fixtures";

test("navigation: all pages remain usable with real IPC", async ({ app }) => {
  for (const name of ["Buscar", "Biblioteca", "Estadísticas", "Configuración"]) {
    await navigate(app, name);
    await expect(app.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name, exact: true }))
      .toHaveAttribute("aria-current", "page");
    await expect(app.locator(".player-bar")).toBeVisible();
  }
  await app.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Inicio", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Selecciones rápidas" })).toBeVisible();
});

test("library: scans three generated WAV files and reads their duration", async ({ app }) => {
  await library(app);
  await expect(app.getByRole("option")).toHaveCount(3);
  for (const name of ["QA Alpha", "QA Beta", "QA Gamma"]) {
    await expect(app.getByRole("option", { name: new RegExp(`Reproducir ${name} de`) })).toContainText("2:00");
  }
});

test("transport: playback progresses, pauses and resumes in Rust", async ({ app }) => {
  await playFirst(app);
  await expect.poll(async () => (await playback(app)).position).toBeGreaterThan(0.5);
  await app.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect.poll(async () => (await playback(app)).playing).toBe(false);
  const paused = (await playback(app)).position;
  await app.waitForTimeout(700);
  expect(Math.abs((await playback(app)).position - paused)).toBeLessThan(0.2);
  await app.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect.poll(async () => (await playback(app)).position).toBeGreaterThan(paused + 0.3);
});

test("transport: keyboard seek and volume reach the real player", async ({ app }) => {
  await expect(app.getByRole("slider", { name: "Volumen" })).toHaveValue("0.05");
  await playFirst(app);
  const seek = app.getByRole("slider", { name: "Posición", exact: true });
  await seek.fill("50");
  await expect.poll(async () => (await playback(app)).position).toBeGreaterThan(55);
  await app.getByRole("slider", { name: "Volumen" }).fill("0.12");
  await expect.poll(async () => (await playback(app)).volume).toBeCloseTo(0.12, 2);
  await expect.poll(async () => (await config(app)).volume).toBeCloseTo(0.12, 2);
  await app.reload();
  await expect(app.getByRole("slider", { name: "Volumen" })).toHaveValue("0.12");
});

test("transport: next and previous follow the active collection", async ({ app }) => {
  await playFirst(app);
  await app.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(app.getByRole("button", { name: "Abrir Reproduciendo: QA Beta", exact: true })).toBeVisible();
  await expect.poll(async () => (await playback(app)).current_track).toMatch(/QA Beta\.wav$/);
  await app.getByRole("button", { name: "Anterior", exact: true }).click();
  await expect(app.getByRole("button", { name: "Abrir Reproduciendo: QA Alpha", exact: true })).toBeVisible();
});

test("transport: shuffle and repeat persist to native configuration", async ({ app }) => {
  await app.getByRole("button", { name: "Aleatorio", exact: true }).click();
  await expect.poll(async () => (await config(app)).shuffle).toBe(true);
  await expect(app.getByRole("button", { name: "Aleatorio", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.getByRole("button", { name: /Repetir.*desactivado/i }).click();
  await expect.poll(async () => (await config(app)).repeat).toBe("all");
  await app.reload();
  await expect(app.getByRole("button", { name: "Aleatorio", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.getByRole("button", { name: /Repetir.*todo/i }).click();
  await expect.poll(async () => (await config(app)).repeat).toBe("one");
  await app.getByRole("button", { name: /Repetir.*una/i }).click();
  await expect.poll(async () => (await config(app)).repeat).toBe("off");
});

test("favorites: add, survive reload, play and remove", async ({ app }) => {
  await library(app);
  await app.getByRole("button", { name: "Agregar QA Alpha a favoritos", exact: true }).click();
  await expect.poll(async () => (await config(app)).favorites.length).toBe(1);
  await app.reload();
  await navigate(app, "Biblioteca");
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Favoritos", exact: true }).click();
  const favorites = app.getByRole("region", { name: "Canciones favoritas" });
  await favorites.getByRole("button", { name: /QA Alpha/ }).first().click();
  await expect.poll(async () => (await playback(app)).playing).toBe(true);
  await favorites.getByRole("button", { name: "Quitar QA Alpha de favoritos" }).click();
  await expect.poll(async () => (await config(app)).favorites).toEqual([]);
  await expect(app.getByText("Marcá canciones con el corazón para encontrarlas acá.")).toBeVisible();
});

test("favorites: missing files are explicit, cannot play and can be removed", async ({ app, musicFolder }) => {
  const current = await config(app);
  await ipc(app, "set_config", { config: {
    ...current, favorites: [`${musicFolder}\\QA Missing.wav`],
  } });
  await app.reload();
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(app.getByRole("button", { name: /QA Missing.wav Archivo no disponible/ })).toBeDisabled();
  await app.getByRole("button", { name: "Quitar QA Missing.wav de favoritos", exact: true }).click();
  await expect.poll(async () => (await config(app)).favorites).toEqual([]);
});

test("playlists: create and retain an empty playlist after reload", async ({ app }) => {
  await app.getByRole("button", { name: "Nueva playlist", exact: true }).click();
  await app.getByRole("textbox", { name: "Nombre de la playlist" }).fill("QA Mix");
  await app.getByRole("textbox", { name: "Nombre de la playlist" }).press("Enter");
  await expect.poll(async () => (await config(app)).custom_playlists.map((entry) => entry.name)).toEqual(["QA Mix"]);
  await app.reload();
  await app.getByRole("list", { name: "Playlists" }).getByRole("button", { name: /QA Mix/ }).click();
  await expect(app.getByRole("heading", { name: "QA Mix", exact: true })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Esta playlist está vacía" })).toBeVisible();
});

test("playlists: plays only tracks from a saved playlist", async ({ app, tracks }) => {
  const current = await config(app);
  await ipc(app, "set_config", { config: {
    ...current, custom_playlists: [{ name: "QA Duo", tracks: [tracks[0].path, tracks[2].path] }],
  } });
  await app.reload();
  await app.getByRole("list", { name: "Playlists" }).getByRole("button", { name: /QA Duo/ }).click();
  await expect(app.getByRole("option")).toHaveCount(2);
  await app.getByRole("option", { name: /Reproducir QA Alpha de/ }).click();
  await app.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(app.getByRole("button", { name: "Abrir Reproduciendo: QA Gamma", exact: true })).toBeVisible();
});

test("search: local filtering, no-result state and keyboard shortcut", async ({ app }) => {
  await app.keyboard.press("Control+k");
  await expect(app.getByRole("searchbox", { name: "Buscar música" })).toBeFocused();
  await app.getByRole("group", { name: "Dónde buscar" }).getByRole("button", { name: "Local", exact: true }).click();
  await app.getByRole("searchbox", { name: "Buscar música" }).fill("QA Beta");
  await expect(app.getByRole("button", { name: /Reproducir QA Beta/ })).toHaveCount(1);
  await app.getByRole("button", { name: /Reproducir QA Beta/ }).click();
  await expect.poll(async () => (await playback(app)).current_track).toMatch(/QA Beta\.wav$/);
  await app.getByRole("searchbox", { name: "Buscar música" }).fill("no-match-qa-123");
  await expect(app.getByRole("status")).toContainText("0 resultados");
});

test("now playing: queue, accessible tabs, details and autoplay persist", async ({ app }) => {
  await playFirst(app);
  await app.getByRole("button", { name: "Abrir Reproduciendo: QA Alpha", exact: true }).click();
  await expect(app.getByRole("list", { name: "Cola de reproducción" }).getByRole("button")).toHaveCount(3);
  await app.getByRole("switch", { name: "Autoplay" }).uncheck();
  expect(await app.evaluate(() => localStorage.getItem("flowplayer-autoplay"))).toBe("off");
  await app.getByRole("tab", { name: "Cola", exact: true }).focus();
  await app.keyboard.press("End");
  await expect(app.getByRole("tab", { name: "Detalles", exact: true })).toBeFocused();
  await expect(app.getByRole("tabpanel")).toContainText("Archivo local");
  await expect(app.getByRole("tabpanel")).toContainText("QA Alpha");
  await app.keyboard.press("Escape");
  await expect(app.getByRole("region", { name: "Reproduciendo", exact: true })).toHaveCount(0);
});

test("history: a real play appears in statistics and home after reload", async ({ app }) => {
  await playFirst(app);
  await expect.poll(async () => (await history(app)).map((entry) => entry.title)).toContain("QA Alpha");
  await app.reload();
  await expect(app.getByRole("region", { name: "Volver a escuchar" })).toContainText("QA Alpha");
  await navigate(app, "Estadísticas");
  await expect(app.getByRole("region", { name: "Resumen" }).locator(".stats__value").first()).toHaveText("1");
  await expect(app.getByRole("table", { name: "Reproducciones por día" }).getByRole("row")).toHaveCount(8);
});

test("history: date ranges and explicit clear confirmation", async ({ app, tracks }) => {
  const now = Date.now();
  for (const [index, playedAt] of [now, now - 10 * 86_400_000].entries()) {
    await ipc(app, "record_play", { entry: { ...tracks[index], source: "local", playedAt } });
  }
  await navigate(app, "Estadísticas");
  const plays = app.getByRole("region", { name: "Resumen" }).locator(".stats__value").first();
  await expect(plays).toHaveText("1");
  await app.getByRole("button", { name: "30 días", exact: true }).click();
  await expect(plays).toHaveText("2");
  await app.getByRole("button", { name: "Siempre", exact: true }).click();
  await expect(plays).toHaveText("2");
  await app.getByRole("button", { name: "Borrar historial", exact: true }).click();
  await app.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await history(app)).toHaveLength(2);
  await app.getByRole("button", { name: "Borrar historial", exact: true }).click();
  await app.getByRole("button", { name: "Sí, borrar todo", exact: true }).click();
  await expect(app.getByRole("heading", { name: "Todavía no hay historial" })).toBeVisible();
  expect(await history(app)).toEqual([]);
});

test("settings: accent and startup mode survive a WebView reload", async ({ app }) => {
  await navigate(app, "Configuración");
  await app.getByRole("radio", { name: "Verde", exact: true }).click();
  await expect(app.getByRole("radio", { name: "Verde", exact: true })).toHaveAttribute("aria-checked", "true");
  await app.getByRole("radiogroup", { name: "Modo al iniciar" }).getByRole("radio", { name: /^Flow/ }).click();
  await app.reload();
  await expect(app.locator(".layout--flow")).toBeVisible();
  expect(await app.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())).toBe("#5fd3a0");
  await app.getByRole("button", { name: "Modo Normal", exact: true }).click();
  await navigate(app, "Configuración");
  await expect(app.getByRole("radiogroup", { name: "Modo al iniciar" }).getByRole("radio", { name: /^Flow/ }))
    .toHaveAttribute("aria-checked", "true");
});

test("radio: add a station and retain it after reload", async ({ app }) => {
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Radio", exact: true }).click();
  await app.getByRole("button", { name: "+ Agregar", exact: true }).click();
  await app.getByRole("textbox", { name: "Nombre de la emisora" }).fill("QA Station");
  await app.getByRole("textbox", { name: "URL de la transmisión" }).fill("https://example.test/qa-station");
  await app.getByRole("textbox", { name: "Género de la emisora" }).fill("QA");
  await app.getByRole("button", { name: "Guardar emisora", exact: true }).click();
  await expect.poll(async () => (await config(app)).custom_radio_stations.map((station) => station.name)).toEqual(["QA Station"]);
  await app.reload();
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Radio", exact: true }).click();
  await expect(app.getByRole("button", { name: "Reproducir radio QA Station", exact: true })).toBeVisible();
});

test("modes: Flow, Zen and Mini change the native window and restore Normal", async ({ app }, testInfo) => {
  await playFirst(app);
  const original = await app.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await app.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Flow", exact: true }).click();
  await expect(app.locator(".sidebar")).toHaveClass(/sidebar--collapsed/);
  await capture(app, testInfo, "flow");
  await app.getByRole("button", { name: "Modo Zen", exact: true }).click();
  await expect(app.locator(".zen-view")).toBeVisible();
  await capture(app, testInfo, "zen");
  await app.keyboard.press("Escape");
  await expect(app.locator(".layout--normal")).toBeVisible();
  await app.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Mini", exact: true }).click();
  await expect.poll(() => app.evaluate(() => innerWidth)).toBe(320);
  await expect.poll(() => app.evaluate(() => innerHeight)).toBe(200);
  const mini = await app.locator(".mini-view__card").boundingBox();
  expect(mini).not.toBeNull();
  expect(mini!.width).toBeGreaterThanOrEqual(319);
  expect(mini!.height).toBeGreaterThanOrEqual(199);
  expect(await app.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor))
    .toMatch(/^rgb\(/);
  await expect(app.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await capture(app, testInfo, "mini");
  await app.getByRole("button", { name: "Expandir", exact: true }).click();
  await expect.poll(() => app.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(original);
});

test("Flow: Pomodoro starts, pauses and resets without stopping audio", async ({ app }) => {
  await playFirst(app);
  await app.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Flow", exact: true }).click();
  const timer = app.locator(".pomodoro");
  await expect(timer.locator(".pomodoro__time")).toHaveText("25:00");
  await timer.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(timer.locator(".pomodoro__time")).not.toHaveText("25:00");
  await timer.getByRole("button", { name: "Pausar", exact: true }).click();
  const paused = await timer.locator(".pomodoro__time").textContent();
  await app.waitForTimeout(1100);
  await expect(timer.locator(".pomodoro__time")).toHaveText(paused!);
  expect((await playback(app)).playing).toBe(true);
  await timer.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(timer.locator(".pomodoro__time")).toHaveText("25:00");
  await expect(timer.getByRole("button", { name: "Iniciar", exact: true })).toBeVisible();
});

test("downloads: empty catalog and offline controls are explicit", async ({ app }) => {
  await library(app);
  await app.getByRole("group", { name: "Colecciones" }).getByRole("button", { name: "Descargas de YouTube", exact: true }).click();
  await expect(app.getByText("Todavía no hay canciones descargadas. Usá Agregar de YouTube.")).toBeVisible();
  await app.getByRole("button", { name: "Agregar de YouTube", exact: true }).click();
  await app.getByRole("searchbox", { name: "Buscar online en YouTube o pegar enlace" }).fill("QA");
  await app.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(app.getByRole("button", { name: "Buscar / inspeccionar", exact: true })).toBeDisabled();
  await expect(app.getByText("Sin conexión: podés reproducir tus descargas completas.")).toBeVisible();
});
