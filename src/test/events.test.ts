import { describe, it, expect } from "vitest";
import { TRACK_ENDED, PLAYBACK_ERROR } from "../lib/events";

describe("events", () => {
  it("TRACK_ENDED has correct value", () => {
    expect(TRACK_ENDED).toBe("track-ended");
  });

  it("PLAYBACK_ERROR has correct value", () => {
    expect(PLAYBACK_ERROR).toBe("playback-error");
  });
});
