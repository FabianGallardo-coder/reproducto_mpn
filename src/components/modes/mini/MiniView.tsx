import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Track } from "../../../types";
import { formatTime } from "../../../lib/format";
import { isAndroid } from "../../../lib/platform";
import { useCoverArt } from "../../../lib/useCoverArt";
import { MusicIcon, PrevIcon, NextIcon, PlayIcon, PauseIcon } from "../../ui/Icons";

interface Props {
  currentTrack: Track | null;
  playing: boolean;
  positionValue: number;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (pos: number) => void;
  onExpand: () => void;
}

export function MiniView({
  currentTrack,
  playing,
  positionValue,
  onToggle,
  onNext,
  onPrevious,
  onSeek,
  onExpand,
}: Props) {
  const coverUrl = useCoverArt(currentTrack?.path);
  const duration = currentTrack?.duration ?? 0;

  // data-tauri-drag-region only reacts to the exact element, so children like
  // the cover or title blocked dragging. Drag from anywhere except controls.
  const handleDragStart = (e: MouseEvent<HTMLDivElement>) => {
    if (isAndroid || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, a")) return;
    e.preventDefault();
    getCurrentWindow().startDragging().catch((err) => {
      console.error("Failed to drag mini window:", err);
    });
  };

  return (
    <div className="mini-view" onMouseDown={handleDragStart}>
      <div className="mini-view__card">
        <button className="mini-view__close" onClick={onExpand} aria-label="Expandir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="mini-view__row">
          {coverUrl ? (
            <img src={coverUrl} alt={`${currentTrack?.title ?? "Track"} album art`} className="mini-view__art" />
          ) : (
            <div className="mini-view__art mini-view__art--empty">
              <MusicIcon size={32} />
            </div>
          )}
          <div className="mini-view__info">
            <div className="mini-view__title">{currentTrack?.title ?? "Nada en reproducción"}</div>
            <div className="mini-view__artist">{currentTrack?.artist ?? ""}</div>
          </div>
        </div>
        <div className="mini-view__controls">
          <button className="mini-view__btn" onClick={onPrevious} aria-label="Pista anterior">
            <PrevIcon size={20} />
          </button>
          <button className="mini-view__btn mini-view__btn--play" onClick={onToggle} aria-label={playing ? "Pausar" : "Reproducir"}>
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button className="mini-view__btn" onClick={onNext} aria-label="Pista siguiente">
            <NextIcon size={20} />
          </button>
        </div>
        <div className="mini-view__seek">
          <span className="mini-view__time">{formatTime(positionValue)}</span>
          <input
            type="range"
            className="mini-view__seek-bar"
            min={0}
            max={duration || 1}
            step={0.1}
            value={positionValue}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            aria-label="Posición"
          />
          <span className="mini-view__time">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
