import type { Mode, Track } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  position: number;
  error: string | null;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (position: number) => void;
  onClearError: () => void;
  children: React.ReactNode;
}

export function AppLayout({
  mode,
  onModeChange,
  currentTrack,
  playing,
  volume,
  position,
  error,
  onToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onClearError,
  children,
}: Props) {
  if (mode === "zen") {
    return (
      <div className="layout layout--zen">
        {error && (
          <div className="error-toast" onClick={onClearError}>
            {error}
          </div>
        )}
        <div className="layout__zen-content">{children}</div>
      </div>
    );
  }

  return (
    <div className={`layout layout--${mode}`}>
      {error && (
        <div className="error-toast" onClick={onClearError}>
          {error}
        </div>
      )}
      <Sidebar mode={mode} onModeChange={onModeChange}>
        <button className="sidebar__item sidebar__item--active">Library</button>
      </Sidebar>
      <main className="layout__main">{children}</main>
      <PlayerBar
        currentTrack={currentTrack}
        playing={playing}
        volume={volume}
        position={position}
        onToggle={onToggle}
        onNext={onNext}
        onPrevious={onPrevious}
        onVolumeChange={onVolumeChange}
        onSeek={onSeek}
      />
    </div>
  );
}
