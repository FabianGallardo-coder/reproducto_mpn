import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCENTS, accentById, applyAccent, readAccentId, useAccentColor } from "../hooks/useAccentColor";
import { readStartMode, writeStartMode } from "../lib/startMode";
import { readAutoplay, writeAutoplay } from "../lib/autoplay";
import { shortcutsText, SHORTCUTS } from "../lib/shortcuts";
import { useMode } from "../hooks/useMode";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
});

describe("accent color", () => {
  it("defaults to violeta and ignores unknown stored values", () => {
    expect(readAccentId()).toBe("violeta");
    localStorage.setItem("flowplayer-accent", "naranja");
    expect(readAccentId()).toBe("violeta");
    expect(accentById("nope").id).toBe("violeta");
  });

  it("applies the CSS variables of a preset", () => {
    applyAccent(accentById("rojo"));
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--accent")).toBe("#ff6b81");
    expect(style.getPropertyValue("--accent-rgb")).toBe("255, 107, 129");
    expect(style.getPropertyValue("--accent-soft")).toBe("rgba(255, 107, 129, 0.14)");
  });

  it("every preset keeps readable dark text on the accent", () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const preset of ACCENTS) {
      const [light, dark] = [luminance(preset.color), luminance(preset.foreground)].sort((a, b) => b - a);
      expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("persists the choice and applies it through the hook", () => {
    const { result } = renderHook(() => useAccentColor());
    expect(result.current[0]).toBe("violeta");
    act(() => result.current[1]("verde"));
    expect(result.current[0]).toBe("verde");
    expect(localStorage.getItem("flowplayer-accent")).toBe("verde");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#5fd3a0");
  });
});

describe("start mode", () => {
  it("defaults to normal and persists flow", () => {
    expect(readStartMode()).toBe("normal");
    writeStartMode("flow");
    expect(readStartMode()).toBe("flow");
  });

  it("is used as the initial mode", () => {
    writeStartMode("flow");
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe("flow");
  });
});

describe("autoplay preference", () => {
  it("is on by default and can be turned off", () => {
    expect(readAutoplay()).toBe(true);
    writeAutoplay(false);
    expect(readAutoplay()).toBe(false);
    writeAutoplay(true);
    expect(readAutoplay()).toBe(true);
  });
});

describe("shortcuts", () => {
  it("renders a text summary with every shortcut", () => {
    const text = shortcutsText();
    for (const shortcut of SHORTCUTS) expect(text).toContain(`${shortcut.keys}: ${shortcut.description}`);
  });
});
