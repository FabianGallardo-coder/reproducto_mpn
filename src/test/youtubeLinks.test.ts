import { describe, expect, it } from "vitest";
import { youtubeIdFromUrl } from "../types/youtube";

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
