import type { PlayHistoryEntry } from "../types/history";

export type StatsRange = "7d" | "30d" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function rangeDays(range: StatsRange): number | null {
  return range === "7d" ? 7 : range === "30d" ? 30 : null;
}

export function filterByRange(entries: PlayHistoryEntry[], range: StatsRange, now: number): PlayHistoryEntry[] {
  const days = rangeDays(range);
  if (days === null) return entries;
  const since = startOfLocalDay(now) - (days - 1) * DAY_MS;
  return entries.filter((entry) => entry.playedAt >= since);
}

export interface Summary {
  plays: number;
  /** Approximation: the sum of each played track's duration. */
  minutes: number;
  artists: number;
}

export function summarize(entries: PlayHistoryEntry[]): Summary {
  const seconds = entries.reduce((total, entry) => total + (entry.duration > 0 ? entry.duration : 0), 0);
  const artists = new Set(entries.map((entry) => entry.artist.trim().toLocaleLowerCase()).filter(Boolean));
  return { plays: entries.length, minutes: Math.round(seconds / 60), artists: artists.size };
}

export interface TrackStat {
  path: string;
  plays: number;
  /** Most recent play of the track (carries metadata and source). */
  latest: PlayHistoryEntry;
}

export function topTracks(entries: PlayHistoryEntry[], limit = 10): TrackStat[] {
  const stats = new Map<string, TrackStat>();
  for (const entry of entries) {
    const current = stats.get(entry.path);
    if (!current) stats.set(entry.path, { path: entry.path, plays: 1, latest: entry });
    else {
      current.plays += 1;
      if (entry.playedAt > current.latest.playedAt) current.latest = entry;
    }
  }
  return [...stats.values()]
    .sort((a, b) => b.plays - a.plays || b.latest.playedAt - a.latest.playedAt)
    .slice(0, limit);
}

export interface ArtistStat {
  artist: string;
  plays: number;
}

export function topArtists(entries: PlayHistoryEntry[], limit = 5): ArtistStat[] {
  const counts = new Map<string, ArtistStat>();
  for (const entry of entries) {
    const name = entry.artist.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const current = counts.get(key);
    if (current) current.plays += 1;
    else counts.set(key, { artist: name, plays: 1 });
  }
  return [...counts.values()].sort((a, b) => b.plays - a.plays || a.artist.localeCompare(b.artist)).slice(0, limit);
}

export interface DayActivity {
  key: string;
  timestamp: number;
  plays: number;
}

/** One bucket per local day, oldest first, ending today. */
export function activityByDay(entries: PlayHistoryEntry[], days: number, now: number): DayActivity[] {
  const today = startOfLocalDay(now);
  const buckets: DayActivity[] = [];
  const index = new Map<string, DayActivity>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const timestamp = today - offset * DAY_MS;
    const bucket = { key: dayKey(timestamp), timestamp, plays: 0 };
    buckets.push(bucket);
    index.set(bucket.key, bucket);
  }
  for (const entry of entries) {
    const bucket = index.get(dayKey(entry.playedAt));
    if (bucket) bucket.plays += 1;
  }
  return buckets;
}

export interface DayGroup {
  key: string;
  timestamp: number;
  entries: PlayHistoryEntry[];
}

/** Groups entries (already newest first) by local day, preserving order. */
export function groupByDay(entries: PlayHistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.playedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, timestamp: startOfLocalDay(entry.playedAt), entries: [entry] });
  }
  return groups;
}

export function dayLabel(timestamp: number, now: number): string {
  const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(timestamp)) / DAY_MS);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(timestamp));
}
