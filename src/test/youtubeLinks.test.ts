import { describe, expect, it } from "vitest";
import { classifyYouTubeInput, youtubeIdFromUrl } from "../types/youtube";

describe("YouTube link validation", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtube.com/embed/dQw4w9WgXcQ",
    "https://youtube.com/live/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=example",
  ])("extracts the video ID from official URL %s", (url) => {
    expect(youtubeIdFromUrl(url)).toBe("dQw4w9WgXcQ");
  });

  it.each([
    "", "not a URL", "javascript:alert(1)",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/playlist?list=dQw4w9WgXcQ",
    "https://youtube.com/watch", "https://youtu.be/short",
    "https://youtu.be/dQw4w9WgXcQx", "https://youtu.be/dQw4w9WgXc!",
    "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
  ])("rejects unsupported or invalid URL %s", (url) => {
    expect(youtubeIdFromUrl(url)).toBeNull();
  });
});

describe("classifyYouTubeInput", () => {
  it("treats text as a search", () => {
    expect(classifyYouTubeInput("linkin park")).toEqual({ kind: "text" });
  });

  it("keeps the exact video of a link that also carries a mix playlist", () => {
    expect(classifyYouTubeInput("https://www.youtube.com/watch?v=L50II6zJy9U&list=RDL50II6zJy9U&start_radio=1"))
      .toEqual({ kind: "video", id: "L50II6zJy9U" });
  });

  it("recognizes playlist-only links and normalizes them", () => {
    expect(classifyYouTubeInput("https://m.youtube.com/playlist?list=PLabc123&si=x"))
      .toEqual({ kind: "playlist", url: "https://www.youtube.com/playlist?list=PLabc123" });
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/playlist?list=PLabc123",
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/playlist",
  ])("marks %s as invalid", (url) => {
    expect(classifyYouTubeInput(url)).toEqual({ kind: "invalid" });
  });
});
