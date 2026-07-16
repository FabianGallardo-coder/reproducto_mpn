import { describe, it, expect } from "vitest";
import { parseLrc } from "../components/Lyrics";

describe("parseLrc", () => {
  it("parses standard LRC lines", () => {
    const lrc = "[00:05.23]Hello world\n[00:12.00]Second line";
    const result = parseLrc(lrc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ time: 5.23, text: "Hello world" });
    expect(result[1]).toEqual({ time: 12, text: "Second line" });
  });

  it("handles 3-digit milliseconds", () => {
    const result = parseLrc("[01:30.456]Text");
    expect(result[0].time).toBeCloseTo(90.456, 2);
    expect(result[0].text).toBe("Text");
  });

  it("handles 2-digit milliseconds by padding", () => {
    const result = parseLrc("[00:10.50]Short ms");
    expect(result[0].time).toBeCloseTo(10.5, 2);
  });

  it("skips lines without timestamps", () => {
    const lrc = "Just some text\n[00:01.00]Valid\nNo timestamp here";
    expect(parseLrc(lrc)).toHaveLength(1);
  });

  it("returns empty array for empty string", () => {
    expect(parseLrc("")).toEqual([]);
  });

  it("returns empty array for no matching lines", () => {
    expect(parseLrc("[invalid]\nnothing")).toEqual([]);
  });

  it("handles text after timestamp with extra spaces", () => {
    const result = parseLrc("[00:03.00]   Padded text  ");
    expect(result[0].text).toBe("Padded text  ");
  });

  it("handles lines with empty text", () => {
    const result = parseLrc("[00:00.00]");
    expect(result[0]).toEqual({ time: 0, text: "" });
  });

  it("parses minutes and seconds correctly", () => {
    const result = parseLrc("[02:05.00]Song line");
    expect(result[0].time).toBeCloseTo(125, 1);
  });
});
