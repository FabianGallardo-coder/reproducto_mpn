import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Track } from "../types";
import { MusicIcon } from "./ui/Icons";

const ROW_HEIGHT = 52;
const BUFFER = 5;

interface TrackItemProps {
  track: Track;
  isActive: boolean;
  onSelect: (track: Track) => void;
  style: React.CSSProperties;
}

function TrackItem({ track, isActive, onSelect, style }: TrackItemProps) {
  return (
    <div
      className={`track-list__item ${isActive ? "track-list__item--active" : ""}`}
      onClick={() => onSelect(track)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(track); } }}
      tabIndex={0}
      role="option"
      aria-selected={isActive}
      style={style}
    >
      <div className="track-list__item-content">
        <MusicIcon size={16} className={`track-list__heart-icon ${isActive ? 'track-list__heart-icon--active' : ''}`} />
        <div className="track-list__info">
          <span className="track-list__title">{track.title}</span>
          <span className="track-list__artist">{track.artist}</span>
          <span className="track-list__album">{track.album}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  onSelect: (track: Track) => void;
  loading?: boolean;
  scanProgress?: { processed: number; found: number } | null;
}

export function TrackList({ tracks, currentTrack, onSelect, loading, scanProgress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    setScrollTop(containerRef.current?.scrollTop ?? 0);
  }, []);

  const totalHeight = tracks.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(
    tracks.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER,
  );

  const visibleTracks = useMemo(
    () => tracks.slice(startIndex, endIndex),
    [tracks, startIndex, endIndex],
  );

  if (loading) {
    return (
      <div className="track-list__loading" role="status" aria-live="polite">
        <div className="track-list__loading-label">
          {scanProgress
            ? `Scanning… ${scanProgress.found} found · ${scanProgress.processed} files`
            : "Scanning…"}
        </div>
        <div className="track-list__progress" aria-hidden="true">
          <div className="track-list__progress-bar" />
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return <div className="track-list__empty">No tracks. Scan a folder.</div>;
  }

  return (
    <div ref={containerRef} className="track-list" role="listbox" aria-label="Track list" onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleTracks.map((t, i) => (
          <TrackItem
            key={t.path}
            track={t}
            isActive={currentTrack?.path === t.path}
            onSelect={onSelect}
            style={{
              position: "absolute",
              top: (startIndex + i) * ROW_HEIGHT,
              left: 0,
              right: 0,
              height: ROW_HEIGHT,
            }}
          />
        ))}
      </div>
    </div>
  );
}
