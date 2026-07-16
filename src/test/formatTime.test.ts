import { describe, it, expect } from "vitest";
import { formatTime } from "../lib/format";

describe("formatTime", () => {
  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(45)).toBe("0:45");
  });

  it("formats exactly one minute", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(125)).toBe("2:05");
  });

  it("pads single-digit seconds", () => {
    expect(formatTime(61)).toBe("1:01");
  });

  it("handles large durations", () => {
    expect(formatTime(3661)).toBe("61:01");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(65.9)).toBe("1:05");
  });

  it("formats 10 minutes", () => {
    expect(formatTime(600)).toBe("10:00");
  });

  it("handles NaN as 0:00", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("handles negative as 0:00", () => {
    expect(formatTime(-5)).toBe("0:00");
  });

  it("handles Infinity as 0:00", () => {
    expect(formatTime(Infinity)).toBe("0:00");
  });
});
