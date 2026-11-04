import { invoke } from "@tauri-apps/api/core";
import { invoke as platformInvoke, isAndroid } from "./platform";

/** Opens an http(s) URL in the system browser (Tauri shell plugin), falling back to a new tab outside Tauri. */
export async function openExternal(url: string): Promise<void> {
  if (!/^https:\/\//i.test(url)) return;
  if (isAndroid) {
    await platformInvoke("open_external", { url });
    return;
  }
  try {
    await invoke("plugin:shell|open", { path: url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
