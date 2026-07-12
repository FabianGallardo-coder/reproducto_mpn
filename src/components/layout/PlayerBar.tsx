import type { Track } from "../../types";

interface Props {
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  position: number;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (position: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar({
  currentTrack,
  playing,
  volume,
  position,
  onToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
}: Props) {
  const duration = currentTrack?.duration ?? 0;

  return (
    <div className="player-bar">
      <div className="player-bar__track">
        {currentTrack ? (
          <>
            <span className="player-bar__title">{currentTrack.title}</span>
            <span className="player-bar__artist">{currentTrack.artist}</span>
          </>
        ) : (
          <span className="player-bar__empty">No track playing</span>
        )}
      </div>

      <div className="player-bar__center">
        <div className="player-bar__controls">
          <button onClick={onPrevious} className="player-bar__btn">
            Prev
          </button>
          <button
            onClick={onToggle}
            className="player-bar__btn player-bar__btn--main"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={onNext} className="player-bar__btn">
            Next
          </button>
        </div>
        <div className="player-bar__seek-row">
          <span className="player-bar__time">{formatTime(position)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={position}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="player-bar__seek"
          />
          <span className="player-bar__time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-bar__volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="player-bar__slider"
        />
      </div>
    </div>
  );
}
