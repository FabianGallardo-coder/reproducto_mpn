import { useEffect, useSyncExternalStore } from "react";

export interface AccentPreset {
  id: string;
  label: string;
  color: string;
  hover: string;
  /** Dark text color with at least 4.5:1 contrast on `color`. */
  foreground: string;
}

export const ACCENTS: ReadonlyArray<AccentPreset> = [
  { id: "violeta", label: "Violeta", color: "#c49aff", hover: "#d3b5ff", foreground: "#21172d" },
  { id: "rojo", label: "Rojo", color: "#ff6b81", hover: "#ff8fa0", foreground: "#2a0b12" },
  { id: "azul", label: "Azul", color: "#6ea8ff", hover: "#93bdff", foreground: "#0b1a33" },
  { id: "verde", label: "Verde", color: "#5fd3a0", hover: "#86e1ba", foreground: "#07261a" },
];

const KEY = "flowplayer-accent";
const EVENT = "flowplayer-accent-changed";
const DEFAULT_ID = ACCENTS[0].id;

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

export function readAccentId(): string {
  try {
    const stored = localStorage.getItem(KEY);
    return stored && ACCENTS.some((accent) => accent.id === stored) ? stored : DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

export function applyAccent(preset: AccentPreset): void {
  const [r, g, b] = hexToRgb(preset.color);
  const style = document.documentElement.style;
  style.setProperty("--accent", preset.color);
  style.setProperty("--accent-hover", preset.hover);
  style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
  style.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, 0.14)`);
  style.setProperty("--accent-foreground", preset.foreground);
  style.setProperty("--glow", `0 0 20px rgba(${r}, ${g}, ${b}, 0.2)`);
}

function writeAccentId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Persisting is best effort; listeners still update below.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Applies the saved accent color to the document and exposes it for the settings page. */
export function useAccentColor(): [string, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, readAccentId, () => DEFAULT_ID);
  useEffect(() => applyAccent(accentById(id)), [id]);
  return [id, writeAccentId];
}
