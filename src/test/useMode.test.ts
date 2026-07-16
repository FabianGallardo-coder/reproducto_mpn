import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useMode } from "../hooks/useMode";

describe("useMode", () => {
  it("starts in normal mode", () => {
    const { result } = renderHook(() => useMode());
    expect(result.current.mode).toBe("normal");
  });

  it("cycles normal → flow → zen → mini → normal", () => {
    const { result } = renderHook(() => useMode());

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("flow");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("zen");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("mini");

    act(() => result.current.cycleMode());
    expect(result.current.mode).toBe("normal");
  });

  it("setMode overrides directly", () => {
    const { result } = renderHook(() => useMode());

    act(() => result.current.setMode("zen"));
    expect(result.current.mode).toBe("zen");
  });
});
