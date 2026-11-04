import { useState, useEffect, useRef } from "react";
import { api } from "./api";

const cache = new Map<string, string>();

export function useCoverArt(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    // Drop the previous cover immediately so a new track never shows stale art.
    setUrl(null);
    if (!path || /^(https?:|youtube:)/i.test(path)) return;
    const cached = cache.get(path);
    if (cached) { setUrl(cached); return; }

    let cancelled = false;
    api.getCover(path).then((bytes) => {
      if (cancelled || !bytes) return;
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
      const objectUrl = URL.createObjectURL(blob);
      cache.set(path, objectUrl);
      if (!cancelled) setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [path]);

  return url;
}
