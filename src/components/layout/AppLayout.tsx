import { useEffect } from "react";
import type { Mode } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import { YouTubeHost } from "../nowplaying/YouTubeHost";
import { YouTubeStageProvider } from "../nowplaying/YouTubeStage";
import { usePlayerState, usePlayerActions } from "../../hooks/usePlayerStore";
import { youtubeIdFromPath } from "../../types/youtube";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  children: React.ReactNode;
}

export function AppLayout({ mode, onModeChange, children }: Props) {
  const { error, currentTrack } = usePlayerState();
  const { clearError, pause } = usePlayerActions();
  const simple = mode === "zen" || mode === "mini";
  const youtubeActive = currentTrack ? youtubeIdFromPath(currentTrack.path) !== null : false;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  // Zen and Mini have no room for the (always visible) official player, so playback pauses instead of hiding it.
  useEffect(() => {
    if (simple && youtubeActive) void pause();
  }, [simple, youtubeActive, pause]);

  if (simple) {
    return (
      <div key="simple" className={`layout layout--${mode}`}>
        {error && <ErrorToast error={error} onDismiss={clearError} />}
        <div className="layout__zen-content">{children}</div>
      </div>
    );
  }

  return (
    <YouTubeStageProvider>
      <div key="full" className={`layout layout--${mode}`}>
        {error && <ErrorToast error={error} onDismiss={clearError} />}
        <Sidebar mode={mode} onModeChange={onModeChange} />
        <main className="layout__main">{children}</main>
        <PlayerBar onOpenNowPlaying={() => onModeChange("normal")} />
        <YouTubeHost onOpenNowPlaying={() => onModeChange("normal")} />
      </div>
    </YouTubeStageProvider>
  );
}

function ErrorToast({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="error-toast">
      <span role="alert" aria-live="assertive">{error}</span>
      <button type="button" onClick={onDismiss}       aria-label="Cerrar error">
              Cerrar
      </button>
    </div>
  );
}
