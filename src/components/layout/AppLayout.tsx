import { useState } from "react";
import type { Mode, Track, RepeatMode } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import { RadioPanel } from "../RadioPanel";
import { YouTubePanel } from "../YouTubePanel";
import { api } from "../../lib/api";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  currentTrack: Track | null;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  positionValue: number;
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
  positionValue,
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
  const [sidebarTab, setSidebarTab] = useState<"library" | "radio" | "youtube">("library");

  const handlePlayUrl = (url: string) => {
    api.playUrl(url).catch(() => {});
  };

  const isSimple = mode === "zen" || mode === "mini";
  const layoutKey = isSimple ? "simple" : "full";

  if (isSimple) {
    return (
      <div key={layoutKey} className={`layout layout--${mode}`}>
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
    <div key={layoutKey} className={`layout layout--${mode}`}>
      {error && (
        <div className="error-toast" onClick={onClearError}>
          {error}
        </div>
      )}
      <Sidebar mode={mode} onModeChange={onModeChange} onSearch={onSearch}>
        <div className="sidebar__tabs">
          <button
            className={`sidebar__tab ${sidebarTab === "library" ? "sidebar__tab--active" : ""}`}
            onClick={() => setSidebarTab("library")}
          >
            Library
          </button>
          <button
            className={`sidebar__tab ${sidebarTab === "radio" ? "sidebar__tab--active" : ""}`}
            onClick={() => setSidebarTab("radio")}
          >
            Radio
          </button>
          <button
            className={`sidebar__tab ${sidebarTab === "youtube" ? "sidebar__tab--active" : ""}`}
            onClick={() => setSidebarTab("youtube")}
          >
            YT
          </button>
        </div>
        {sidebarTab === "radio" ? (
          <RadioPanel onPlay={handlePlayUrl} />
        ) : sidebarTab === "youtube" ? (
          <YouTubePanel onPlay={handlePlayUrl} />
        ) : null}
      </Sidebar>
      <main className="layout__main">{children}</main>
      <PlayerBar
        currentTrack={currentTrack}
        playing={playing}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        positionValue={positionValue}
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
