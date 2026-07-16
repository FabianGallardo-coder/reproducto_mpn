import { useState } from "react";
import type { Mode } from "../../types";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import { RadioPanel } from "../RadioPanel";
import { YouTubePanel } from "../YouTubePanel";
import { api } from "../../lib/api";
import { usePlayerState, usePlayerActions } from "../../hooks/usePlayerStore";

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSearch?: (query: string) => void;
  children: React.ReactNode;
}

export function AppLayout({
  mode,
  onModeChange,
  onSearch,
  children,
}: Props) {
  const [sidebarTab, setSidebarTab] = useState<"library" | "radio" | "youtube">("library");
  const { error } = usePlayerState();
  const { clearError } = usePlayerActions();

  const handlePlayUrl = (url: string) => {
    api.playUrl(url).catch(() => {});
  };

  const isSimple = mode === "zen" || mode === "mini";
  const layoutKey = isSimple ? "simple" : "full";

  if (isSimple) {
    return (
      <div key={layoutKey} className={`layout layout--${mode}`}>
        {error && (
          <div className="error-toast" onClick={clearError}>
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
        <div className="error-toast" onClick={clearError}>
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
      <PlayerBar />
    </div>
  );
}
