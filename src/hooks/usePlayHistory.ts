import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { PlayHistoryEntry } from "../types/history";

export const HISTORY_CHANGED_EVENT = "flowplayer-history-changed";

export interface PlayHistory {
  /** Newest first. */
  entries: PlayHistoryEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => Promise<void>;
}

export function usePlayHistory(): PlayHistory {
  const [entries, setEntries] = useState<PlayHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const history = await api.getHistory();
      if (mounted.current) setEntries(history);
    } catch (error) {
      console.error("No se pudo leer el historial:", error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await api.clearHistory();
    if (mounted.current) setEntries([]);
    window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT));
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(HISTORY_CHANGED_EVENT, onChanged);
    return () => {
      mounted.current = false;
      window.removeEventListener(HISTORY_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  return { entries, loading, refresh, clear };
}
