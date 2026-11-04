import { useEffect, useRef } from "react";

type KeyBinding = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
};

export function useShortcuts(bindings: KeyBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      if (target instanceof HTMLElement && target.closest("button, a, [role='tab'], [role='button'], [role='slider']") &&
        !e.altKey && !e.ctrlKey && !e.metaKey) return;
      for (const b of bindingsRef.current) {
        const ctrlMatch = b.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
        const altMatch = b.alt ? e.altKey : !e.altKey;
        const shiftMatch = b.shift ? e.shiftKey : !e.shiftKey;

        if (e.code === b.key && ctrlMatch && altMatch && shiftMatch) {
          e.preventDefault();
          b.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export type { KeyBinding };
