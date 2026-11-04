import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/api", () => ({ api: { getCover: vi.fn() } }));

import { api } from "../lib/api";
import { useCoverArt } from "../lib/useCoverArt";

describe("useCoverArt", () => {
  beforeEach(() => {
    vi.mocked(api.getCover).mockReset();
    URL.createObjectURL = vi.fn(() => "blob:cover-a");
  });

  it("clears the previous cover when the next track has none", async () => {
    vi.mocked(api.getCover).mockResolvedValueOnce([1, 2, 3]).mockResolvedValueOnce(null);

    const { result, rerender } = renderHook(({ path }) => useCoverArt(path), {
      initialProps: { path: "C:\\Music\\with-cover.mp3" },
    });
    await waitFor(() => expect(result.current).toBe("blob:cover-a"));

    rerender({ path: "C:\\Music\\no-cover.m4a" });
    await waitFor(() => expect(api.getCover).toHaveBeenCalledTimes(2));
    expect(result.current).toBeNull();
  });

  it("returns null for streaming URLs without calling the backend", () => {
    const { result } = renderHook(() => useCoverArt("https://example.com/stream"));
    expect(result.current).toBeNull();
    expect(api.getCover).not.toHaveBeenCalled();
  });
});
