import { useState, useEffect } from "react";
import { api } from "./api";

const cache = new Map<string, string>();

export function useCoverArt(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    path ? (cache.get(path) ?? null) : null,
  );

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const cached = cache.get(path);
    if (cached) { setUrl(cached); return; }

    let cancelled = false;
    api.getCover(path).then((bytes) => {
      if (cancelled || !bytes) return;
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
      const objectUrl = URL.createObjectURL(blob);
      cache.set(path, objectUrl);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  return url;
}
