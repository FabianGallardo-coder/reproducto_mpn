import { useState, useEffect, useRef } from "react";
import { api, type LrcLyrics } from "../lib/api";
import { MusicIcon } from "./ui/Icons";

interface Props {
  artist: string;
  title: string;
  album?: string;
  duration?: number;
  position: number;
}

export function parseLrc(lrc: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  for (const line of lrc.split("\n")) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, "0"), 10);
      lines.push({ time: min * 60 + sec + ms / 1000, text: match[4] });
    }
  }
  return lines;
}

export function Lyrics({ artist, title, album, duration, position }: Props) {
  const [lyrics, setLyrics] = useState<LrcLyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artist || !title) return;
    let cancelled = false;
    setLoading(true);
    setTimedOut(false);
    const timer = setTimeout(() => { if (!cancelled) setTimedOut(true); }, 4000);
    api.fetchLyrics(artist, title, album, duration).then((l) => {
      if (cancelled) return;
      clearTimeout(timer);
      setLyrics(l);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      clearTimeout(timer);
      setLyrics(null);
      setLoading(false);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [artist, title, album, duration]);

  const syncedLines = lyrics?.synced_lyrics ? parseLrc(lyrics.synced_lyrics) : null;

  let activeIndex = -1;
  if (syncedLines) {
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].time <= position) activeIndex = i;
      else break;
    }
  }

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  if (loading && !timedOut) return <div className="lyrics lyrics--loading">Syncing lyrics...</div>;
  if (loading && timedOut) return <div className="lyrics lyrics--loading">No lyrics available</div>;
  if (!lyrics) return null;

  if (syncedLines && syncedLines.length > 0) {
    return (
      <div className="lyrics" ref={containerRef}>
        {syncedLines.map((line, i) => (
          <div
            key={i}
            ref={i === activeIndex ? activeRef : undefined}
            className={`lyrics__line ${i === activeIndex ? "lyrics__line--active" : ""}`}
          >
            <MusicIcon size={16} className={`lyrics__heart ${i === activeIndex ? "lyrics__heart--active" : ""}`} />
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (lyrics.plain_lyrics) {
    return (
      <div className="lyrics">
        {lyrics.plain_lyrics.split("\n").map((line, i) => (
          <div key={i} className="lyrics__line">
            <MusicIcon size={16} className="lyrics__heart" />
            <span>{line}</span>
          </div>
        ))}
      </div>
    );
  }

  if (lyrics.instrumental) {
    return <div className="lyrics lyrics--instrumental">Instrumental</div>;
  }

  return null;
}
