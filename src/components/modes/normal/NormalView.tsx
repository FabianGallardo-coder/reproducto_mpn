import type { Track } from "../../../types";
import { TrackList } from "../../TrackList";

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  onSelect: (track: Track) => void;
}

export function NormalView({ tracks, currentTrack, onSelect }: Props) {
  return (
    <div className="normal-view">
      <div className="normal-view__header">
        <h2>Library</h2>
      </div>
      <TrackList tracks={tracks} currentTrack={currentTrack} onSelect={onSelect} />
    </div>
  );
}
