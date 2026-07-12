import { useCallback, useMemo } from "react";
import type { Track, RepeatMode } from "../../types";

interface Props {
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  positionRef: React.RefObject<number>;
  seekBarRef: React.Ref<HTMLInputElement>;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (position: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat one",
};

export function PlayerBar({
  currentTrack,
  playing,
  volume,
  shuffle,
  repeat,
  positionRef,
  seekBarRef,
  onToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
}: Props) {
  const duration = currentTrack?.duration ?? 0;
  const durationLabel = useMemo(() => formatTime(duration), [duration]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSeek(parseFloat(e.target.value)),
    [onSeek],
  );

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
          <button
            onClick={onToggleShuffle}
            className={`player-bar__btn player-bar__btn--icon ${shuffle ? "player-bar__btn--active" : ""}`}
            aria-label="Toggle shuffle"
          >
            S
          </button>
          <button onClick={onPrevious} className="player-bar__btn" aria-label="Previous track">
            Prev
          </button>
          <button
            onClick={onToggle}
            className="player-bar__btn player-bar__btn--main"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={onNext} className="player-bar__btn" aria-label="Next track">
            Next
          </button>
          <button
            onClick={onCycleRepeat}
            className={`player-bar__btn player-bar__btn--icon ${repeat !== "off" ? "player-bar__btn--active" : ""}`}
            aria-label={REPEAT_LABELS[repeat]}
          >
            {repeat === "one" ? "R1" : "R"}
          </button>
        </div>
        <div className="player-bar__seek-row">
          <span className="player-bar__time">{formatTime(positionRef.current ?? 0)}</span>
          <input
            ref={seekBarRef}
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            defaultValue="0"
            onChange={handleSeek}
            className="player-bar__seek"
            aria-label="Seek position"
          />
          <span className="player-bar__time">{durationLabel}</span>
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
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
