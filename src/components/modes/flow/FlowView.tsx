import type { Track } from "../../../types";
import { useCoverArt } from "../../../lib/useCoverArt";
import { MusicIcon } from "../../ui/Icons";
import { TrackList } from "../../TrackList";
import { PomodoroTimer } from "../../PomodoroTimer";
import { Visualizer } from "../../Visualizer";
import { Lyrics } from "../../Lyrics";

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  playing: boolean;
  position: number;
  onSelect: (track: Track) => void;
  loading?: boolean;
  scanProgress?: { processed: number; found: number } | null;
}

export function FlowView({ tracks, currentTrack, playing, position, onSelect, loading, scanProgress }: Props) {
  return (
    <div className="flow-view">
      <div className="flow-view__top">
        <PomodoroTimer />
        <Visualizer playing={playing} />
      </div>
      <div className="flow-view__tracks">
        <TrackList tracks={tracks} currentTrack={currentTrack} onSelect={onSelect} loading={loading} scanProgress={scanProgress} />
      </div>
      <div className="flow-view__bottom">
        <div className="flow-view__lyrics-col">
          {currentTrack && (
            <Lyrics
              artist={currentTrack.artist}
              title={currentTrack.title}
              album={currentTrack.album}
              duration={currentTrack.duration}
              position={position}
            />
          )}
        </div>
        <div className="flow-view__np-col">
          {currentTrack ? (
            <>
              {currentTrack.path && (
                <FlowCover path={currentTrack.path} />
              )}
              <div className="flow-view__np-title">{currentTrack.title}</div>
              <div className="flow-view__np-artist">{currentTrack.artist}</div>
            </>
          ) : (
            <div className="flow-view__np-empty">
              <MusicIcon size={32} />
              <span>No track</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowCover({ path }: { path: string }) {
  const url = useCoverArt(path);
  if (!url) return <div className="flow-view__np-art" />;
  return <img src={url} alt="" className="flow-view__np-art" />;
}
