import { useState, useCallback } from "react";
import type { Mode } from "../types";

export function useMode() {
  const [mode, setMode] = useState<Mode>("normal");

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "normal") return "flow";
      if (prev === "flow") return "zen";
      return "normal";
    });
  }, []);

  return { mode, setMode, cycleMode };
}
