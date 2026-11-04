import { useRef, useEffect } from "react";
import { formatTime } from "../../lib/format";
import { useCoverArt } from "../../lib/useCoverArt";
import { usePlayerState, usePlayerActions } from "../../hooks/usePlayerStore";
import { useNavigation } from "../../hooks/useNavigation";
import { youtubeIdFromPath, youtubeThumbnailUrl } from "../../types/youtube";
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
  HeartIcon,
  MusicIcon,
} from "../ui/Icons";

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: "Repetir desactivado",
  all: "Repetir todo",
  one: "Repetir una canción",
};

export function PlayerBar({ onOpenNowPlaying }: { onOpenNowPlaying?: () => void }) {
  const {
    currentTrack,
    playing,
    volume,
    shuffle,
    repeat,
    positionRef,
    positionValue,
    favorites,
  } = usePlayerState();
  const {
    toggle,
    next,
    previous,
    setVolume,
    seek,
    toggleShuffle,
    cycleRepeat,
    toggleFavorite,
  } = usePlayerActions();

  const duration = currentTrack?.duration ?? 0;
  const localCover = useCoverArt(currentTrack?.path);
  const videoId = currentTrack ? youtubeIdFromPath(currentTrack.path) : null;
  const coverUrl = localCover ?? (videoId ? youtubeThumbnailUrl(videoId) : null);
  const { navigate } = useNavigation();

  const seekInputRef = useRef<HTMLInputElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      if (!draggingRef.current && seekInputRef.current && duration > 0) {
        const pct = Math.min(100, (positionRef.current / duration) * 100);
        seekInputRef.current.value = String(pct);
      }
      if (elapsedRef.current) {
        elapsedRef.current.textContent = formatTime(positionRef.current);
      }
    };
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    update();
    // Smooth animation only while audio is moving; a paused player refreshes on state changes.
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentTrack, duration, playing, positionRef, positionValue]);

  return (
    <div className="player-bar">
      <div className="player-bar__track">
        {currentTrack ? (
          <>
            <button
              type="button"
              className="player-bar__now"
              aria-label={`Abrir Reproduciendo: ${currentTrack.title}`}
              onClick={() => {
                onOpenNowPlaying?.();
                navigate("reproduciendo");
              }}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="" className="player-bar__art" />
              ) : (
                <span className="player-bar__art player-bar__art--empty"><MusicIcon size={18} /></span>
              )}
              <span className="player-bar__track-info">
                <span className="player-bar__title">{currentTrack.title}</span>
                <span className="player-bar__artist">{currentTrack.artist}</span>
              </span>
            </button>
            {!videoId && (
              <button
                onClick={() => toggleFavorite(currentTrack.path)}
                className={`player-bar__btn player-bar__btn--icon ${favorites.includes(currentTrack.path) ? "player-bar__btn--faved" : ""}`}
                aria-pressed={favorites.includes(currentTrack.path)}
                aria-label="Favorito"
              >
                <HeartIcon size={18} filled={favorites.includes(currentTrack.path)} />
              </button>
            )}
          </>
        ) : (
          <span className="player-bar__empty">Nada en reproducción</span>
        )}
      </div>

      <div className="player-bar__center">
        <div className="player-bar__controls">
          <button
            onClick={toggleShuffle}
            className={`player-bar__btn player-bar__btn--icon ${shuffle ? "player-bar__btn--active" : ""}`}
            aria-label="Aleatorio"
            aria-pressed={shuffle}
          >
            <ShuffleIcon />
          </button>
          <button onClick={previous} className="player-bar__btn player-bar__btn--icon" aria-label="Anterior">
            <PrevIcon />
          </button>
          <button
            onClick={toggle}
            className={`player-bar__btn player-bar__btn--play ${playing ? "player-bar__btn--play--active" : ""}`}
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button onClick={next} className="player-bar__btn player-bar__btn--icon" aria-label="Siguiente">
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
          <span className="player-bar__time" ref={elapsedRef}>{formatTime(0)}</span>
          <div className="player-bar__seek-container">
            <input
              type="range"
              ref={seekInputRef}
              min="0"
              max="100"
              step="0.1"
              onPointerDown={() => { draggingRef.current = true; }}
              onPointerUp={() => { draggingRef.current = false; }}
              onPointerCancel={() => { draggingRef.current = false; }}
              onChange={(e) => seek(parseFloat(e.target.value) / 100 * (duration || 1))}
              className="player-bar__seek"
              aria-label="Posición"
              disabled={!currentTrack || duration <= 0}
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
          aria-label="Volumen"
        />
      </div>
    </div>
  );
}
