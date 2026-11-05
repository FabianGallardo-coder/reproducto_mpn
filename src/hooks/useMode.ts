import { useState, useCallback, type SetStateAction } from "react";
import type { Mode } from "../types";
import { isModeAvailable, readStartMode } from "../lib/startMode";

export function useMode() {
  const [mode, updateMode] = useState<Mode>(readStartMode);

  const setMode = useCallback((next: SetStateAction<Mode>) => {
    updateMode((current) => {
      const requested = typeof next === "function" ? next(current) : next;
      if (!isModeAvailable(requested)) {
        console.warn(`Mode ${requested} is not available on this platform.`);
        return current;
      }
      return requested;
    });
  }, []);

  const cycleMode = useCallback(() => {
    updateMode((prev) => {
      const modes: Mode[] = ["normal", "flow", "zen", "mini"];
      const available = modes.filter(isModeAvailable);
      return available[(available.indexOf(prev) + 1) % available.length];
    });
  }, []);

  return { mode, setMode, cycleMode };
}
