import type { Mode } from "../types";
import { isAndroid } from "./platform";

export type StartMode = Extract<Mode, "normal" | "flow">;

const KEY = "flowplayer-start-mode";

export function isModeAvailable(mode: Mode): boolean {
  return !isAndroid || mode === "normal" || mode === "zen";
}

export function readStartMode(): StartMode {
  try {
    return isModeAvailable("flow") && localStorage.getItem(KEY) === "flow" ? "flow" : "normal";
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
