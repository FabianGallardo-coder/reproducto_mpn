import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "./lib/api";
import { usePlaylist } from "./hooks/usePlaylist";
import { useMode } from "./hooks/useMode";
import { useShortcuts } from "./hooks/useShortcuts";
import { AppLayout } from "./components/layout/AppLayout";
import { NormalView } from "./components/modes/normal/NormalView";
import { FlowView } from "./components/modes/flow/FlowView";
import { ZenView } from "./components/modes/zen/ZenView";

function App() {
  const playlist = usePlaylist();
  const { mode, setMode, cycleMode } = useMode();
  const [musicFolder, setMusicFolder] = useState("");

  useEffect(() => {
    api.getConfig().then((c) => {
      setMusicFolder(c.music_folder);
      api.setVolume(c.volume);
      playlist.loadLibrary(c.music_folder);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setMusicFolder(selected);
      playlist.loadLibrary(selected);
      api.setConfig({
        music_folder: selected,
        volume: playlist.volume,
      });
    }
  }, [playlist.volume, playlist.loadLibrary]);

  useShortcuts([
    { key: "Space", action: playlist.toggle, description: "Play/Pause" },
    {
      key: "KeyN",
      alt: true,
      action: () => setMode("normal"),
      description: "Normal mode",
    },
    {
      key: "KeyF",
      alt: true,
      action: () => setMode("flow"),
      description: "Flow mode",
    },
    {
      key: "KeyZ",
      alt: true,
      action: () => setMode("zen"),
      description: "Zen mode",
    },
    { key: "Tab", action: cycleMode, description: "Cycle modes" },
    {
      key: "ArrowRight",
      ctrl: true,
      action: playlist.next,
      description: "Next track",
    },
    {
      key: "ArrowLeft",
      ctrl: true,
      action: playlist.previous,
      description: "Previous track",
    },
    {
      key: "ArrowUp",
      ctrl: true,
      action: () =>
        playlist.setVolume(Math.min(1, playlist.volume + 0.05)),
      description: "Volume up",
    },
    {
      key: "ArrowDown",
      ctrl: true,
      action: () =>
        playlist.setVolume(Math.max(0, playlist.volume - 0.05)),
      description: "Volume down",
    },
    { key: "KeyO", ctrl: true, action: handleSelectFolder, description: "Open folder" },
  ]);

  const content = (() => {
    switch (mode) {
      case "flow":
        return (
          <FlowView
            tracks={playlist.tracks}
            currentTrack={playlist.currentTrack}
            playing={playlist.playing}
            onSelect={playlist.playTrack}
          />
        );
      case "zen":
        return (
          <ZenView
            currentTrack={playlist.currentTrack}
            playing={playlist.playing}
          />
        );
      default:
        return (
          <NormalView
            tracks={playlist.tracks}
            currentTrack={playlist.currentTrack}
            onSelect={playlist.playTrack}
          />
        );
    }
  })();

  return (
    <AppLayout
      mode={mode}
      onModeChange={setMode}
      currentTrack={playlist.currentTrack}
      playing={playlist.playing}
      volume={playlist.volume}
      position={playlist.position}
      error={playlist.error}
      onToggle={playlist.toggle}
      onNext={playlist.next}
      onPrevious={playlist.previous}
      onVolumeChange={playlist.setVolume}
      onSeek={playlist.seek}
      onClearError={playlist.clearError}
    >
      {mode !== "zen" && (
        <button className="app__folder-btn" onClick={handleSelectFolder}>
          {musicFolder || "Select music folder"}
        </button>
      )}
      {content}
    </AppLayout>
  );
}

export default App;
