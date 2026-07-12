import type { Mode, Track, RepeatMode } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  positionRef: React.RefObject<number>;
  seekBarRef: React.Ref<HTMLInputElement>;
  error: string | null;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (v: number) => void;
  onSeek: (position: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onClearError: () => void;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export function AppLayout({
  mode,
  onModeChange,
  currentTrack,
  playing,
  volume,
  shuffle,
  repeat,
  positionRef,
  seekBarRef,
  error,
  onToggle,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onClearError,
  onSearch,
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
      <Sidebar mode={mode} onModeChange={onModeChange} onSearch={onSearch}>
        <button className="sidebar__item sidebar__item--active">Library</button>
      </Sidebar>
      <main className="layout__main">{children}</main>
      <PlayerBar
        currentTrack={currentTrack}
        playing={playing}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        positionRef={positionRef}
        seekBarRef={seekBarRef}
        onToggle={onToggle}
        onNext={onNext}
        onPrevious={onPrevious}
        onVolumeChange={onVolumeChange}
        onSeek={onSeek}
        onToggleShuffle={onToggleShuffle}
        onCycleRepeat={onCycleRepeat}
      />
    </div>
  );
}
