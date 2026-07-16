import type { Track } from "../../../types";
import { formatTime } from "../../../lib/format";
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

  return (
    <div className="mini-view">
      <div className="mini-view__card">
        <button className="mini-view__expand" onClick={onExpand} aria-label="Expand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
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
            <div className="mini-view__title">{currentTrack?.title ?? "No track"}</div>
            <div className="mini-view__artist">{currentTrack?.artist ?? ""}</div>
          </div>
        </div>
        <div className="mini-view__controls">
          <button className="mini-view__btn" onClick={onPrevious} aria-label="Previous track">
            <PrevIcon size={20} />
          </button>
          <button className="mini-view__btn mini-view__btn--play" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button className="mini-view__btn" onClick={onNext} aria-label="Next track">
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
            aria-label="Seek position"
          />
          <span className="mini-view__time">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
