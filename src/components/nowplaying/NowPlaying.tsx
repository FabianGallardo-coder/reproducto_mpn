import { useEffect } from "react";
import "../../styles/pages/reproduciendo.css";
import { useNavigation } from "../../hooks/useNavigation";
import { usePlayerActions, usePlayerState } from "../../hooks/usePlayerStore";
import { useCoverArt } from "../../lib/useCoverArt";
import { youtubeIdFromPath, youtubeThumbnailUrl } from "../../types/youtube";
import { ChevronDownIcon, HeartIcon, MusicIcon } from "../ui/Icons";
import { NowPlayingPanel } from "./NowPlayingPanel";
import { useYouTubeStage } from "./YouTubeStage";

export function NowPlaying() {
  const { currentTrack, favorites } = usePlayerState();
  const { toggleFavorite } = usePlayerActions();
  const { closeNowPlaying } = useNavigation();
  const { setStage } = useYouTubeStage();
  const coverUrl = useCoverArt(currentTrack?.path);
  const videoId = currentTrack ? youtubeIdFromPath(currentTrack.path) : null;
  const backdrop = coverUrl ?? (videoId ? youtubeThumbnailUrl(videoId) : null);
  const isFavorite = currentTrack ? favorites.includes(currentTrack.path) : false;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNowPlaying();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeNowPlaying]);

  return (
    <section className="nowplaying" aria-label="Reproduciendo">
      {backdrop && <div className="nowplaying__backdrop" style={{ backgroundImage: `url("${backdrop}")` }} aria-hidden="true" />}
      <div className="nowplaying__main">
        <button type="button" className="nowplaying__close" aria-label="Cerrar Reproduciendo" onClick={closeNowPlaying}>
          <ChevronDownIcon size={22} />
        </button>

        {currentTrack ? (
          <>
            <div className="nowplaying__stage">
              {videoId ? (
                <div className="nowplaying__video-slot" ref={setStage} data-testid="youtube-stage" />
              ) : coverUrl ? (
                <img className="nowplaying__art" src={coverUrl} alt={`Portada de ${currentTrack.title}`} />
              ) : (
                <div className="nowplaying__art nowplaying__art--empty" role="img" aria-label="Sin portada">
                  <MusicIcon size={72} />
                </div>
              )}
            </div>
            <div className="nowplaying__meta" aria-live="polite">
              <div className="nowplaying__heading">
                <h1 className="nowplaying__title">{currentTrack.title}</h1>
                {!videoId && (
                  <button
                    type="button"
                    className={`nowplaying__heart ${isFavorite ? "nowplaying__heart--on" : ""}`}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                    onClick={() => void toggleFavorite(currentTrack.path)}
                  >
                    <HeartIcon size={22} filled={isFavorite} />
                  </button>
                )}
              </div>
              <p className="nowplaying__artist">{currentTrack.artist}</p>
              {currentTrack.album && <p className="nowplaying__album">{currentTrack.album}</p>}
            </div>
          </>
        ) : (
          <div className="nowplaying__empty">
            <MusicIcon size={56} />
            <h1 className="nowplaying__title">Nada en reproducción</h1>
            <p className="nowplaying__album">Elegí una canción para verla acá.</p>
          </div>
        )}
      </div>
      <NowPlayingPanel />
    </section>
  );
}
