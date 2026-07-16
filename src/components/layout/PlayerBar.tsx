import { formatTime } from "../../lib/format";
import { useCoverArt } from "../../lib/useCoverArt";
import { usePlayerState, usePlayerActions } from "../../hooks/usePlayerStore";
import type { RepeatMode } from "../../types";
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  VolumeIcon,
} from "../ui/Icons";

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: "Repeat off",
  all: "Repeat all",
  one: "Repeat one",
};

export function PlayerBar() {
  const {
    currentTrack,
    playing,
    volume,
    shuffle,
    repeat,
    positionValue,
  } = usePlayerState();
  const {
    toggle,
    next,
    previous,
    setVolume,
    seek,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerActions();

  const duration = currentTrack?.duration ?? 0;
  const coverUrl = useCoverArt(currentTrack?.path);

  return (
    <div className="player-bar">
      <div className="player-bar__track">
        {currentTrack ? (
          <>
            {coverUrl ? (
              <img src={coverUrl} alt={`${currentTrack.title} album art`} className="player-bar__art" />
            ) : (
              <div className="player-bar__art player-bar__art--empty"><span style={{fontSize:18}}>&#9835;</span></div>
            )}
            <div className="player-bar__track-info">
              <div className="player-bar__title">{currentTrack.title}</div>
              <div className="player-bar__artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <span className="player-bar__empty">No track playing</span>
        )}
      </div>

      <div className="player-bar__center">
        <div className="player-bar__controls">
          <button
            onClick={toggleShuffle}
            className={`player-bar__btn player-bar__btn--icon ${shuffle ? "player-bar__btn--active" : ""}`}
            aria-label="Toggle shuffle"
          >
            <ShuffleIcon />
          </button>
          <button onClick={previous} className="player-bar__btn player-bar__btn--icon" aria-label="Previous track">
            <PrevIcon />
          </button>
          <button
            onClick={toggle}
            className={`player-bar__btn player-bar__btn--play ${playing ? "player-bar__btn--play--active" : ""}`}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button onClick={next} className="player-bar__btn player-bar__btn--icon" aria-label="Next track">
            <NextIcon />
          </button>
          <button
            onClick={cycleRepeat}
            className={`player-bar__btn player-bar__btn--icon ${repeat !== "off" ? "player-bar__btn--active" : ""}`}
            aria-label={REPEAT_LABELS[repeat]}
          >
            {repeat === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
          </button>
        </div>
        <div className="player-bar__seek-row">
          <span className="player-bar__time">{formatTime(positionValue)}</span>
          <div className="player-bar__seek-container" onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            seek(percent * (duration || 1));
          }}>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={(positionValue / (duration || 1)) * 100}
              onChange={(e) => seek(parseFloat(e.target.value) / 100 * (duration || 1))}
              className="player-bar__seek"
              aria-label="Seek position"
            />
          </div>
          <span className="player-bar__time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-bar__volume">
        <VolumeIcon size={16} className="player-bar__volume-icon" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="player-bar__slider"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
