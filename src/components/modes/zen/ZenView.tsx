import { Visualizer } from "../../Visualizer";
import type { Track } from "../../../types";

interface Props {
  currentTrack: Track | null;
  playing: boolean;
}

export function ZenView({ currentTrack, playing }: Props) {
  return (
    <div className="zen-view">
      <Visualizer playing={playing} />
      {currentTrack && (
        <div className="zen-view__info">
          <div className="zen-view__title">{currentTrack.title}</div>
          <div className="zen-view__artist">{currentTrack.artist}</div>
        </div>
      )}
    </div>
  );
}
