import { useSyncExternalStore } from "react";

const KEY = "flowplayer-autoplay";
const EVENT = "flowplayer-autoplay-changed";

export function readAutoplay(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeAutoplay(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    // Storage can be unavailable; the in-memory event below still updates listeners.
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

export function useAutoplay(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readAutoplay, () => true);
  return [enabled, writeAutoplay];
}
