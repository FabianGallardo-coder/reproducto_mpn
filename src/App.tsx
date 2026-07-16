import { useState, useEffect, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "./lib/api";
import { usePlayerStore } from "./hooks/usePlayerStore";
import { useMode } from "./hooks/useMode";
import { useShortcuts } from "./hooks/useShortcuts";
import { useMediaSession } from "./hooks/useMediaSession";
import { useCoverArt } from "./lib/useCoverArt";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NormalView } from "./components/modes/normal/NormalView";
import { FlowView } from "./components/modes/flow/FlowView";
import { ZenView } from "./components/modes/zen/ZenView";
import { MiniView } from "./components/modes/mini/MiniView";

function App() {
  const player = usePlayerStore();
  const { mode, setMode, cycleMode } = useMode();
  const [musicFolder, setMusicFolder] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const bgCoverUrl = useCoverArt(player.currentTrack?.path);

  useEffect(() => {
    getCurrentWindow().show();
    api.getConfig().then((c) => {
      setMusicFolder(c.music_folder);
      api.setVolume(c.volume);
      player.setShuffle(c.shuffle);
      player.setRepeat(c.repeat ?? "off");
      player.loadLibrary(c.music_folder);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return player.tracks;
    const q = searchQuery.toLowerCase();
    return player.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );
  }, [player.tracks, searchQuery]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") {
        setMusicFolder(selected);
        // Show loading state while loading library
        await player.loadLibrary(selected);
        // Wait for library to load before saving config
        await api.setConfig({
          music_folder: selected,
          volume: player.volume,
          shuffle: player.shuffle,
          repeat: player.repeat,
          last_track_index: null,
          last_position: 0,
        });
      }
    } catch (error) {
      // Handle error - could show a toast or set error state
      console.error("Failed to select folder:", error);
      // Optionally set an error state in the playlist hook if needed
    }
  }, [player.volume, player.shuffle, player.repeat, player.loadLibrary]);

  useShortcuts([
    { key: "Space", action: player.toggle, description: "Play/Pause" },
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
    {
      key: "KeyM",
      alt: true,
      action: () => setMode("mini"),
      description: "Mini mode",
    },
    { key: "Tab", action: cycleMode, description: "Cycle modes" },
    {
      key: "ArrowRight",
      ctrl: true,
      action: player.next,
      description: "Next track",
    },
    {
      key: "ArrowLeft",
      ctrl: true,
      action: player.previous,
      description: "Previous track",
    },
    {
      key: "ArrowUp",
      ctrl: true,
      action: () =>
        player.setVolume(Math.min(1, player.volume + 0.05)),
      description: "Volume up",
    },
    {
      key: "ArrowDown",
      ctrl: true,
      action: () =>
        player.setVolume(Math.max(0, player.volume - 0.05)),
      description: "Volume down",
    },
    { key: "KeyO", ctrl: true, action: handleSelectFolder, description: "Open folder" },
    { key: "KeyS", action: player.toggleShuffle, description: "Toggle shuffle" },
    { key: "KeyR", action: player.cycleRepeat, description: "Cycle repeat" },
  ]);

  const mediaActions = useMemo(
    () => ({
      onPlay: player.resume,
      onPause: player.pause,
      onNext: player.next,
      onPrevious: player.previous,
      onSeek: player.seek,
    }),
    [player.resume, player.pause, player.next, player.previous, player.seek],
  );

  useMediaSession(
    player.currentTrack,
    player.playing,
    player.positionRef.current,
    mediaActions,
  );

  const content = (() => {
    switch (mode) {
      case "flow":
        return (
          <FlowView
            tracks={filteredTracks}
            currentTrack={player.currentTrack}
            playing={player.playing}
            position={player.positionValue}
            onSelect={player.playTrack}
            loading={player.loading}
            scanProgress={player.scanProgress}
          />
        );
      case "zen":
        return (
          <ZenView
            currentTrack={player.currentTrack}
            playing={player.playing}
            onExit={() => setMode("normal")}
            onToggle={player.toggle}
            onNext={player.next}
            onPrevious={player.previous}
          />
        );
      case "mini":
        return (
          <MiniView
            currentTrack={player.currentTrack}
            playing={player.playing}
            positionValue={player.positionValue}
            onToggle={player.toggle}
            onNext={player.next}
            onPrevious={player.previous}
            onSeek={player.seek}
            onExpand={() => setMode("normal")}
          />
        );
      default:
        return (
          <NormalView
            tracks={filteredTracks}
            currentTrack={player.currentTrack}
            onSelect={player.playTrack}
            loading={player.loading}
            scanProgress={player.scanProgress}
          />
        );
    }
  })();

  return (
    <>
      <div className="app-bg">
        {bgCoverUrl && <img src={bgCoverUrl} alt="" className="app-bg__img" />}
      </div>
      <AppLayout
      mode={mode}
      onModeChange={setMode}
      onSearch={setSearchQuery}
    >
      {mode !== "zen" && mode !== "mini" && (
        <button className="app__folder-btn" onClick={handleSelectFolder}>
          {musicFolder || "Select music folder"}
        </button>
      )}
      <ErrorBoundary>{content}</ErrorBoundary>
    </AppLayout>
    </>
  );
}

export default App;
