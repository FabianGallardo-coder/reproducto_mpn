import type { Track } from "../../../types";
import { formatTime } from "../../../lib/format";
import { useCoverArt } from "../../../lib/useCoverArt";
import { MusicIcon } from "../../ui/Icons";
import { TrackList } from "../../TrackList";

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  onSelect: (track: Track) => void;
  loading?: boolean;
}

export function NormalView({ tracks, currentTrack, onSelect, loading }: Props) {
  const coverUrl = useCoverArt(currentTrack?.path);
  const compact = tracks.length > 0 && tracks.length < 10;

  return (
    <div className={`normal-view${compact ? " normal-view--compact" : ""}`}>
      <div className="normal-view__list">
        <div className="normal-view__header">
          <h2>Library</h2>
          <span>{tracks.length} tracks</span>
        </div>
        <TrackList tracks={tracks} currentTrack={currentTrack} onSelect={onSelect} loading={loading} />
      </div>
      <div className="normal-view__now-playing">
        {coverUrl ? (
          <div className="normal-view__cover-wrap">
            <img src={coverUrl} alt={`${currentTrack?.title ?? "Track"} album art`} className="normal-view__cover" />
          </div>
        ) : currentTrack ? (
          <div className="normal-view__cover-wrap">
            <div className="normal-view__cover--empty"><MusicIcon size={48} /></div>
          </div>
        ) : (
          <div className="normal-view__np-empty">
            <MusicIcon size={48} />
            <span>Select a track</span>
          </div>
        )}
        {currentTrack && (
          <div className="normal-view__track-detail">
            <div className={`normal-view__track-title ${currentTrack ? 'active' : ''}`}>{currentTrack.title}</div>
            <div className="normal-view__track-artist">{currentTrack.artist}</div>
            {currentTrack.album && <div className="normal-view__track-album">{currentTrack.album}</div>}
            <div className="normal-view__track-duration">{formatTime(currentTrack.duration)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
