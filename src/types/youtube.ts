import type { Track } from "./index";

export interface YouTubeItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  available: boolean;
}

export interface YouTubeCollection {
  id: string;
  title: string;
  items: YouTubeItem[];
  playlist: boolean;
}

export interface YouTubeDownload extends YouTubeItem {
  path: string;
  missing: boolean;
}

export type DownloadStatus = "pending" | "downloading" | "complete" | "failed" | "cancelled";

export interface DownloadEntry {
  item: YouTubeItem;
  status: DownloadStatus;
  progress: number;
  error: string | null;
}

export interface DownloadJob {
  id: string;
  title: string;
  entries: DownloadEntry[];
}

export interface YouTubeLibrary {
  version: number;
  songs: YouTubeDownload[];
  playlists: YouTubeCollection[];
  jobs: DownloadJob[];
}

export function youtubeTrack(song: YouTubeDownload): Track {
  return { path: song.path, title: song.title, artist: song.artist, album: "YouTube", duration: song.duration };
}

/** Online (not downloaded) YouTube tracks use `youtube:<id>` as their Track.path. */
export const YOUTUBE_PATH_PREFIX = "youtube:";
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function youtubePath(id: string): string {
  return `${YOUTUBE_PATH_PREFIX}${id}`;
}

export function youtubeIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    const id = host === "youtu.be" ? segments[0]
      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
        ? url.pathname === "/watch" ? url.searchParams.get("v")
          : ["shorts", "embed", "live"].includes(segments[0]) ? segments[1] : null
        : null;
    return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

export type YouTubeInput =
  | { kind: "text" }
  | { kind: "video"; id: string }
  | { kind: "playlist"; url: string }
  | { kind: "invalid" };

/** Tells apart a plain search from a pasted link so a link never runs as a text search. */
export function classifyYouTubeInput(value: string): YouTubeInput {
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return { kind: "text" };
  const id = youtubeIdFromUrl(text);
  if (id) return { kind: "video", id };
  try {
    const url = new URL(text);
    const list = url.searchParams.get("list");
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase())
      && url.pathname === "/playlist" && list && /^[A-Za-z0-9_-]{2,64}$/.test(list)) {
      return { kind: "playlist", url: `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` };
    }
  } catch {
    return { kind: "invalid" };
  }
  return { kind: "invalid" };
}

export function youtubeIdFromPath(path: string): string | null {
  if (!path.startsWith(YOUTUBE_PATH_PREFIX)) return null;
  const id = path.slice(YOUTUBE_PATH_PREFIX.length);
  return YOUTUBE_ID_PATTERN.test(id) ? id : null;
}

export function youtubeThumbnailUrl(id: string): string | null {
  return YOUTUBE_ID_PATTERN.test(id) ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : null;
}

export function youtubeWatchUrl(id: string): string | null {
  return YOUTUBE_ID_PATTERN.test(id) ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
}

export function youtubeItemTrack(item: YouTubeItem): Track {
  return { path: youtubePath(item.id), title: item.title, artist: item.artist, album: "YouTube", duration: item.duration };
}

/** Rebuilds a playable item from an online YouTube track; null for any other kind of track. */
export function trackYouTubeItem(track: Track): YouTubeItem | null {
  const id = youtubeIdFromPath(track.path);
  return id ? { id, title: track.title, artist: track.artist, duration: track.duration, available: true } : null;
}
