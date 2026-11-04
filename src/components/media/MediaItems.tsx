import type { ReactNode } from "react";
import "../../styles/pages/media.css";
import { useCoverArt } from "../../lib/useCoverArt";
import { formatTime } from "../../lib/format";
import { youtubeIdFromPath, youtubeThumbnailUrl } from "../../types/youtube";
import { MusicIcon, RadioIcon } from "../ui/Icons";
import type { Track } from "../../types";

export function TrackCover({ path, thumbnail, className = "" }: { path: string; thumbnail?: string | null; className?: string }) {
  const cover = useCoverArt(path);
  const id = youtubeIdFromPath(path);
  const src = cover ?? thumbnail ?? (id ? youtubeThumbnailUrl(id) : null);
  const radio = /^https?:\/\//i.test(path);
  return (
    <span className={`cover ${className}`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : radio ? <RadioIcon size={20} /> : <MusicIcon size={20} />}
    </span>
  );
}

interface RowProps {
  track: Track;
  index?: number;
  active?: boolean;
  thumbnail?: string | null;
  onPlay: () => void;
  actions?: ReactNode;
}

/** Clickable track row; `actions` render outside the play button so they stay independently focusable. */
export function MediaRow({ track, index, active = false, thumbnail, onPlay, actions }: RowProps) {
  return (
    <div className={`media-row ${active ? "media-row--active" : ""}`}>
      <button type="button" className="media-row__main" aria-label={`Reproducir ${track.title}`} onClick={onPlay}>
        {index !== undefined && <span className="media-row__index">{index}</span>}
        <TrackCover path={track.path} thumbnail={thumbnail} className="cover--sm" />
        <span className="media-row__text">
          <span className="media-row__title">{track.title}</span>
          <span className="media-row__sub">{track.artist}</span>
        </span>
        {track.duration > 0 && <span className="media-row__time">{formatTime(track.duration)}</span>}
      </button>
      {actions && <span className="media-row__actions">{actions}</span>}
    </div>
  );
}

interface CardProps {
  track: Track;
  subtitle?: string;
  onPlay: () => void;
}

export function MediaCard({ track, subtitle, onPlay }: CardProps) {
  return (
    <button type="button" className="media-card" aria-label={`Reproducir ${track.title}`} onClick={onPlay}>
      <TrackCover path={track.path} className="cover--lg" />
      <span className="media-card__title">{track.title}</span>
      <span className="media-card__sub">{subtitle ?? track.artist}</span>
    </button>
  );
}
