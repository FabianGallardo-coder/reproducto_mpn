import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Track } from "../types";
import { HeartIcon, MusicIcon } from "./ui/Icons";
import { usePlayerState, usePlayerActions } from "../hooks/usePlayerStore";
import { formatTime } from "../lib/format";
import { useCoverArt } from "../lib/useCoverArt";

const ROW_HEIGHT = 64;
const BUFFER = 5;

interface TrackItemProps {
  track: Track;
  isActive: boolean;
  onSelect: (track: Track) => void;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  style: React.CSSProperties;
}

const TrackItem = React.memo(function TrackItem({ track, isActive, onSelect, isFavorite, onToggleFavorite, style }: TrackItemProps) {
  const coverUrl = useCoverArt(track.path);

  return (
    <div
      className={`track-list__item ${isActive ? "track-list__item--active" : ""}`}
      onClick={() => onSelect(track)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(track); } }}
      tabIndex={0}
      role="option"
      aria-selected={isActive}
      aria-label={`Reproducir ${track.title} de ${track.artist}`}
      style={style}
    >
      <div className="track-list__item-content">
        <div className="track-list__item-left">
          <div className={`track-list__art ${coverUrl ? "track-list__art--cover" : "track-list__art--empty"}`} aria-hidden="true">
            {coverUrl && <img src={coverUrl} alt="" loading="lazy" decoding="async" />}
            {isActive
              ? <span className="track-list__eq"><i /><i /><i /></span>
              : !coverUrl && <MusicIcon size={16} className="track-list__heart-icon" />}
          </div>
          <div className="track-list__info">
            <span className="track-list__title">{track.title}</span>
            <span className="track-list__artist">{track.artist}</span>
            <span className="track-list__album">{track.album}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          className="track-list__fav-btn"
          aria-label={isFavorite ? `Quitar ${track.title} de favoritos` : `Agregar ${track.title} a favoritos`}
          aria-pressed={isFavorite}
          title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <HeartIcon size={16} filled={isFavorite} />
        </button>
        <span className="track-list__duration">{formatTime(track.duration)}</span>
      </div>
    </div>
  );
});

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
  const showingList = !loading && tracks.length > 0;

  const { favorites } = usePlayerState();
  const { toggleFavorite } = usePlayerActions();
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

  // The list container only exists once tracks are loaded, so measure then.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    const ro = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showingList]);

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
            ? `Escaneando… ${scanProgress.found} encontradas · ${scanProgress.processed} archivos`
            : "Escaneando…"}
        </div>
        <div className="track-list__progress" aria-hidden="true">
          <div className="track-list__progress-bar" />
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return <div className="track-list__empty">No hay canciones. Elegí una carpeta para escanearla.</div>;
  }

  return (
    <div ref={containerRef} className="track-list" role="listbox" aria-label="Lista de canciones" onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleTracks.map((t, i) => (
          <TrackItem
            key={t.path}
            track={t}
            isActive={currentTrack?.path === t.path}
            onSelect={onSelect}
            isFavorite={favoritesSet.has(t.path)}
            onToggleFavorite={() => toggleFavorite(t.path)}
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
