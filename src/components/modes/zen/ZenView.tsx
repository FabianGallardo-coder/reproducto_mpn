import { useState, useEffect, useCallback, useRef } from "react";
import { Visualizer } from "../../Visualizer";
import { CloseIcon, PlayIcon, PauseIcon, PrevIcon, NextIcon } from "../../ui/Icons";
import { api } from "../../../lib/api";
import type { Track } from "../../../types";

interface Props {
  currentTrack: Track | null;
  playing: boolean;
  onExit: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function ZenView({ currentTrack, playing, onExit, onToggle, onNext, onPrevious }: Props) {
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAndHide = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    api.setWindowDecorations(false).catch(() => {});
    return () => {
      api.setWindowDecorations(true).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      showAndHide();
    };
    window.addEventListener("mousemove", showAndHide);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("mousemove", showAndHide);
      window.removeEventListener("keydown", handler);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showAndHide, onExit]);

  return (
    <div className="zen-view" onMouseMove={showAndHide}>
      <button
        className="zen-exit"
        style={{
          opacity: showControls ? 0.8 : 0,
          pointerEvents: showControls ? "auto" : "none",
          transition: "opacity 0.5s ease",
          animation: "none",
        }}
        onClick={onExit}
        aria-label="Exit zen mode"
      >
        <CloseIcon size={18} />
      </button>

      <div className="zen-view__visualizer">
        <Visualizer playing={playing} />
      </div>

      {currentTrack && (
        <div
          className="zen-view__info"
          style={{
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? "auto" : "none",
            transition: "opacity 0.5s ease-in-out",
          }}
        >
          <div className="zen-view__title">{currentTrack.title}</div>
          <div className="zen-view__artist">{currentTrack.artist}</div>
        </div>
      )}

      <div
        className="zen-view__controls"
        style={{
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "auto" : "none",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <button onClick={onPrevious} className="zen-view__btn" aria-label="Previous track">
          <PrevIcon />
        </button>
        <button
          onClick={onToggle}
          className="zen-view__btn zen-view__btn--play"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button onClick={onNext} className="zen-view__btn" aria-label="Next track">
          <NextIcon />
        </button>
      </div>
    </div>
  );
}
