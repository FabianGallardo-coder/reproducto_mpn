import type { Mode } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import type { Track } from "../../types";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (v: number) => void;
  children: React.ReactNode;
}

export function AppLayout({
  mode,
  onModeChange,
  currentTrack,
  playing,
  volume,
  onToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  children,
}: Props) {
  if (mode === "zen") {
    return (
      <div className="layout layout--zen">
        <div className="layout__zen-content">{children}</div>
      </div>
    );
  }

  return (
    <div className={`layout layout--${mode}`}>
      <Sidebar mode={mode} onModeChange={onModeChange}>
        <button className="sidebar__item sidebar__item--active">Library</button>
      </Sidebar>
      <main className="layout__main">{children}</main>
      <PlayerBar
        currentTrack={currentTrack}
        playing={playing}
        volume={volume}
        onToggle={onToggle}
        onNext={onNext}
        onPrevious={onPrevious}
        onVolumeChange={onVolumeChange}
      />
    </div>
  );
}
