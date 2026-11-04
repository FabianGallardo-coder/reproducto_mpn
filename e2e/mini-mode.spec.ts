import { expect, test } from "@playwright/test";
import { mockTauri } from "./support/tauri-mock";

test.describe("mini mode", () => {
  test("fills the whole window with an opaque surface (no transparent borders)", async ({ page }) => {
    await mockTauri(page);
    await page.goto("/");
    await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Mini" }).click();

    for (const size of [{ width: 320, height: 200 }, { width: 280, height: 160 }]) {
      await page.setViewportSize(size);
      const layout = await page.evaluate(() => {
        const card = document.querySelector(".mini-view__card")!.getBoundingClientRect();
        const opaque = (el: Element) => {
          const color = getComputedStyle(el).backgroundColor;
          return color !== "rgba(0, 0, 0, 0)" && color !== "transparent";
        };
        return {
          card: { x: card.x, y: card.y, width: card.width, height: card.height },
          viewport: { width: innerWidth, height: innerHeight },
          html: opaque(document.documentElement),
          body: opaque(document.body),
          layout: opaque(document.querySelector(".layout")!),
          overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(layout.card).toEqual({ x: 0, y: 0, ...size });
      expect(layout.html && layout.body && layout.layout).toBe(true);
      expect(layout.overflow).toBe(false);
    }
  });

  test("returns to the full layout with the expand button", async ({ page }) => {
    await mockTauri(page);
    await page.goto("/");
    await page.getByRole("region", { name: "Modos" }).getByRole("button", { name: "Mini" }).click();
    await page.getByRole("button", { name: "Expandir" }).click();
    await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
  });
});
