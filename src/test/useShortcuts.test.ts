import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useShortcuts } from "../hooks/useShortcuts";

function fireKey(key: string, opts?: Partial<KeyboardEventInit>) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: key, ...opts }));
}

describe("useShortcuts", () => {
  it("fires action on matching key", () => {
    const action = vi.fn();
    renderHook(() =>
      useShortcuts([{ key: "Space", action, description: "toggle" }]),
    );

    act(() => fireKey("Space"));
    expect(action).toHaveBeenCalledOnce();
  });

  it("ignores non-matching key", () => {
    const action = vi.fn();
    renderHook(() =>
      useShortcuts([{ key: "Space", action, description: "toggle" }]),
    );

    act(() => fireKey("KeyA"));
    expect(action).not.toHaveBeenCalled();
  });

  it("matches ctrl modifier", () => {
    const action = vi.fn();
    renderHook(() =>
      useShortcuts([{ key: "KeyP", ctrl: true, action, description: "play" }]),
    );

    act(() => fireKey("KeyP", { ctrlKey: true }));
    expect(action).toHaveBeenCalledOnce();

    act(() => fireKey("KeyP"));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("matches alt modifier", () => {
    const action = vi.fn();
    renderHook(() =>
      useShortcuts([
        { key: "Digit1", alt: true, action, description: "mode1" },
      ]),
    );

    act(() => fireKey("Digit1", { altKey: true }));
    expect(action).toHaveBeenCalledOnce();
  });

  it("matches shift modifier", () => {
    const action = vi.fn();
    renderHook(() =>
      useShortcuts([
        { key: "KeyN", shift: true, action, description: "new" },
      ]),
    );

    act(() => fireKey("KeyN", { shiftKey: true }));
    expect(action).toHaveBeenCalledOnce();
  });

  it.each(["input", "button", "select", "textarea", "a"])(
    "does not steal Space from a focused %s",
    (tag) => {
      const action = vi.fn();
      renderHook(() => useShortcuts([{ key: "Space", action, description: "toggle" }]));
      const control = document.createElement(tag);
      document.body.appendChild(control);
      const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
      act(() => { control.dispatchEvent(event); });
      expect(action).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      control.remove();
    },
  );
});
