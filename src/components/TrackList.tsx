import { memo } from "react";
import type { Track } from "../types";

interface TrackItemProps {
  track: Track;
  isActive: boolean;
  onSelect: (track: Track) => void;
}

const TrackItem = memo(function TrackItem({ track, isActive, onSelect }: TrackItemProps) {
  return (
    <li
      className={`track-list__item ${isActive ? "track-list__item--active" : ""}`}
      onClick={() => onSelect(track)}
    >
      <span className="track-list__title">{track.title}</span>
      <span className="track-list__artist">{track.artist}</span>
      <span className="track-list__album">{track.album}</span>
    </li>
  );
});

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  onSelect: (track: Track) => void;
  loading?: boolean;
}

export function TrackList({ tracks, currentTrack, onSelect, loading }: Props) {
  if (loading) {
    return <div className="track-list__loading">Scanning...</div>;
  }

  if (tracks.length === 0) {
    return <div className="track-list__empty">No tracks. Scan a folder.</div>;
  }

  return (
    <ul className="track-list">
      {tracks.map((t) => (
        <TrackItem
          key={t.path}
          track={t}
          isActive={currentTrack?.path === t.path}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
