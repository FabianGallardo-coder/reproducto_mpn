import { useEffect, useLayoutEffect, useState } from "react";
import "../../styles/pages/reproduciendo.css";
import { useYouTubePlayer } from "../../hooks/useYouTubePlayer";
import { useNavigation } from "../../hooks/useNavigation";
import { usePlayerActions, usePlayerState } from "../../hooks/usePlayerStore";
import { describeYouTubeError } from "../../lib/youtubeIframeApi";
import { openExternal } from "../../lib/openExternal";
import { youtubeIdFromPath, youtubeWatchUrl } from "../../types/youtube";
import { CloseIcon, ExternalLinkIcon, QueueIcon } from "../ui/Icons";
import { useYouTubeStage } from "./YouTubeStage";

/**
 * Persistent home of the official YouTube embedded player. It is never hidden: it covers the Now Playing
 * stage when that page is open and otherwise floats (at least 200x200 CSS px) above the player bar.
 */
export function YouTubeHost({ onOpenNowPlaying }: { onOpenNowPlaying?: () => void }) {
  const { currentTrack, playing, volume, positionRef } = usePlayerState();
  const { reportYouTubeState, youtubeEnded, registerYouTubeController, stopYouTube } = usePlayerActions();
  const { stage } = useYouTubeStage();
  const { navigate, route } = useNavigation();
  const videoId = currentTrack ? youtubeIdFromPath(currentTrack.path) : null;
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const { mountRef, controller, status, loadError } = useYouTubePlayer({
    videoId,
    autoplay: playing,
    startSeconds: positionRef.current,
    volume,
    onPlaying: (isPlaying) => reportYouTubeState({ playing: isPlaying }),
    onProgress: (position, duration) => reportYouTubeState({ position, duration }),
    onEnded: youtubeEnded,
    onError: (code) => {
      setErrorCode(code);
      reportYouTubeState({ playing: false });
    },
  });

  useEffect(() => {
    registerYouTubeController(controller);
    return () => registerYouTubeController(null);
  }, [controller, registerYouTubeController]);

  useEffect(() => {
    setErrorCode(null);
  }, [videoId]);

  useLayoutEffect(() => {
    if (!stage) {
      setRect(null);
      return;
    }
    const update = () => setRect(stage.getBoundingClientRect());
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(stage);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [stage]);

  if (!videoId) return null;

  const docked = route === "reproduciendo" && rect !== null;
  const style = docked ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : undefined;
  const message = errorCode !== null ? describeYouTubeError(errorCode) : loadError;
  const watchUrl = youtubeWatchUrl(videoId);

  return (
    <section
      className={`yt-host ${docked ? "yt-host--stage" : "yt-host--float"}`}
      style={style}
      aria-label="Reproductor oficial de YouTube"
    >
      {!docked && (
        <header className="yt-host__bar">
          <span className="yt-host__title">{currentTrack?.title}</span>
          <button type="button" className="yt-host__action" aria-label="Abrir Reproduciendo" onClick={() => {
            onOpenNowPlaying?.();
            navigate("reproduciendo");
          }}>
            <QueueIcon size={14} />
          </button>
          <button type="button" className="yt-host__action" aria-label="Cerrar reproductor de YouTube" onClick={stopYouTube}>
            <CloseIcon size={14} />
          </button>
        </header>
      )}
      <div className="yt-host__video" ref={mountRef} />
      {status === "loading" && <p className="yt-host__status" role="status">Cargando reproductor…</p>}
      {message && (
        <div className="yt-host__error" role="alert">
          <p>{message}</p>
          {watchUrl && (
            <button type="button" className="button" onClick={() => void openExternal(watchUrl)}>
              <ExternalLinkIcon size={14} /> Abrir en YouTube
            </button>
          )}
        </div>
      )}
    </section>
  );
}
