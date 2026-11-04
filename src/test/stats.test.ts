import { describe, expect, it } from "vitest";
import {
  activityByDay,
  dayKey,
  dayLabel,
  filterByRange,
  groupByDay,
  summarize,
  topArtists,
  topTracks,
} from "../lib/stats";
import type { PlayHistoryEntry } from "../types/history";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 10, 2, 12, 0, 0).getTime();

function entry(path: string, hoursAgo: number, overrides: Partial<PlayHistoryEntry> = {}): PlayHistoryEntry {
  return {
    path, title: path, artist: "Artist", album: "Album", duration: 120, source: "local",
    playedAt: NOW - hoursAgo * HOUR, ...overrides,
  };
}

describe("filterByRange", () => {
  const entries = [entry("today", 1), entry("six-days", 6 * 24 + 1), entry("eight-days", 8 * 24), entry("old", 400 * 24)];

  it("keeps the last N local days including today", () => {
    expect(filterByRange(entries, "7d", NOW).map((e) => e.path)).toEqual(["today", "six-days"]);
  });

  it("returns everything for the all-time range", () => {
    expect(filterByRange(entries, "all", NOW)).toHaveLength(4);
  });

  it("covers 30 days", () => {
    expect(filterByRange(entries, "30d", NOW).map((e) => e.path)).toEqual(["today", "six-days", "eight-days"]);
  });
});

describe("summarize", () => {
  it("counts plays, rounds minutes and ignores missing durations and blank artists", () => {
    const summary = summarize([
      entry("a", 1, { duration: 90, artist: "Lumen" }),
      entry("b", 2, { duration: 150, artist: " lumen " }),
      entry("c", 3, { duration: 0, artist: "" }),
    ]);
    expect(summary).toEqual({ plays: 3, minutes: 4, artists: 1 });
  });

  it("is empty for no history", () => {
    expect(summarize([])).toEqual({ plays: 0, minutes: 0, artists: 0 });
  });
});

describe("topTracks", () => {
  it("groups by path, sorts by plays then recency and keeps the latest metadata", () => {
    const stats = topTracks([
      entry("a", 10, { title: "Old title" }),
      entry("a", 1, { title: "New title" }),
      entry("b", 2),
      entry("c", 3),
      entry("c", 4),
    ]);
    expect(stats.map((s) => [s.path, s.plays])).toEqual([["a", 2], ["c", 2], ["b", 1]]);
    expect(stats[0].latest.title).toBe("New title");
  });

  it("limits the result", () => {
    expect(topTracks([entry("a", 1), entry("b", 2), entry("c", 3)], 2)).toHaveLength(2);
  });
});

describe("topArtists", () => {
  it("merges artists case-insensitively and orders ties alphabetically", () => {
    const artists = topArtists([
      entry("a", 1, { artist: "Lumen" }),
      entry("b", 2, { artist: "lumen" }),
      entry("c", 3, { artist: "Harbor" }),
      entry("d", 4, { artist: "Aurora" }),
      entry("e", 5, { artist: "" }),
    ]);
    expect(artists).toEqual([
      { artist: "Lumen", plays: 2 },
      { artist: "Aurora", plays: 1 },
      { artist: "Harbor", plays: 1 },
    ]);
  });
});

describe("activityByDay", () => {
  it("returns one bucket per day, oldest first, ending today", () => {
    const buckets = activityByDay([entry("a", 1), entry("b", 2), entry("c", 30)], 3, NOW);
    expect(buckets).toHaveLength(3);
    expect(buckets[2].key).toBe(dayKey(NOW));
    expect(buckets.map((b) => b.plays)).toEqual([0, 1, 2]);
  });

  it("ignores plays outside the window", () => {
    expect(activityByDay([entry("old", 24 * 20)], 7, NOW).every((b) => b.plays === 0)).toBe(true);
  });
});

describe("groupByDay and dayLabel", () => {
  it("groups consecutive entries of the same local day", () => {
    const groups = groupByDay([entry("a", 1), entry("b", 2), entry("c", 30), entry("d", 60)]);
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1, 1]);
  });

  it("labels today and yesterday and falls back to a long date", () => {
    expect(dayLabel(NOW - HOUR, NOW)).toBe("Hoy");
    expect(dayLabel(NOW - DAY, NOW)).toBe("Ayer");
    expect(dayLabel(NOW - 5 * DAY, NOW)).toMatch(/\d/);
  });
});
