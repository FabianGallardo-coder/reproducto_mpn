import { useEffect, useCallback } from "react";

type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
};

export function useShortcuts(bindings: KeyBinding[]) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      for (const b of bindings) {
        const ctrlMatch = b.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
        const altMatch = b.alt ? e.altKey : !e.altKey;
        const shiftMatch = b.shift ? e.shiftKey : !e.shiftKey;

        if (e.code === b.key && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault();
          b.action();
          return;
        }
      }
    },
    [bindings],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

export type { KeyBinding };
