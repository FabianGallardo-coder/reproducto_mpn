import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core";

export const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) && isTauri();

export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return isAndroid
    ? tauriInvoke<T>("mobile_command", { command, args: args ?? {} })
    : tauriInvoke<T>(command, args);
}

export async function selectMedia(directory: boolean): Promise<string | null> {
  if (isAndroid) return invoke<string | null>(directory ? "select_folder" : "select_file");
  const { open } = await import("@tauri-apps/plugin-dialog");
  return open(directory
    ? { directory: true, multiple: false }
    : { multiple: false, filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"] }] });
}
