import type { Track } from "../types";

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  onSelect: (track: Track) => void;
}

export function TrackList({ tracks, currentTrack, onSelect }: Props) {
  if (tracks.length === 0) {
    return <div className="track-list__empty">No tracks. Scan a folder.</div>;
  }

  return (
    <ul className="track-list">
      {tracks.map((t) => (
        <li
          key={t.path}
          className={`track-list__item ${currentTrack?.path === t.path ? "track-list__item--active" : ""}`}
          onClick={() => onSelect(t)}
        >
          <span className="track-list__title">{t.title}</span>
          <span className="track-list__artist">{t.artist}</span>
          <span className="track-list__album">{t.album}</span>
        </li>
      ))}
    </ul>
  );
}
