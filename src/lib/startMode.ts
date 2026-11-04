import type { Mode } from "../types";

export type StartMode = Extract<Mode, "normal" | "flow">;

const KEY = "flowplayer-start-mode";

export function readStartMode(): StartMode {
  try {
    return localStorage.getItem(KEY) === "flow" ? "flow" : "normal";
  } catch {
    return "normal";
  }
}

export function writeStartMode(mode: StartMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Best effort: the preference simply won't persist.
  }
}
