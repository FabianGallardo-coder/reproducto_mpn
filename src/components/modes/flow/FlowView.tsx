import type { Track } from "../../../types";
import { TrackList } from "../../TrackList";
import { PomodoroTimer } from "../../PomodoroTimer";
import { Visualizer } from "../../Visualizer";

interface Props {
  tracks: Track[];
  currentTrack: Track | null;
  playing: boolean;
  onSelect: (track: Track) => void;
}

export function FlowView({ tracks, currentTrack, playing, onSelect }: Props) {
  return (
    <div className="flow-view">
      <div className="flow-view__top">
        <PomodoroTimer />
        <Visualizer playing={playing} />
      </div>
      <div className="flow-view__tracks">
        <TrackList tracks={tracks} currentTrack={currentTrack} onSelect={onSelect} />
      </div>
    </div>
  );
}
