import { useState, useCallback } from "react";
import type { Mode } from "../types";
import { readStartMode } from "../lib/startMode";

export function useMode() {
  const [mode, setMode] = useState<Mode>(readStartMode);

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "normal") return "flow";
      if (prev === "flow") return "zen";
      if (prev === "zen") return "mini";
      return "normal";
    });
  }, []);

  return { mode, setMode, cycleMode };
}
