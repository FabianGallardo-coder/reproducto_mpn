import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(resolve(__dirname, "../../src-tauri/tauri.conf.json"), "utf8"));
const csp: string = config.app.security.csp;
const directive = (name: string) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";

describe("Content Security Policy", () => {
  it("allows embedded cover art (blob: object URLs) and YouTube thumbnails as images", () => {
    const sources = directive("img-src").split(/\s+/);
    expect(sources).toEqual(expect.arrayContaining(["'self'", "blob:", "https://i.ytimg.com"]));
  });

  it("does not open blob: or data: to scripts", () => {
    const sources = directive("script-src").split(/\s+/);
    expect(sources).not.toContain("blob:");
    expect(sources).not.toContain("data:");
  });
});
