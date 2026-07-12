import { useState, useCallback } from "react";
import { api } from "../lib/api";
import type { Track } from "../types";

export function useLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const scan = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await api.scanFolder(path);
      setTracks(result);
    } finally {
      setLoading(false);
    }
  }, []);

  return { tracks, loading, scan };
}
