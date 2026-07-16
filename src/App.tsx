import { useState, useEffect, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "./lib/api";
import { usePlaylist } from "./hooks/usePlaylist";
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
  const playlist = usePlaylist();
  const { mode, setMode, cycleMode } = useMode();
  const [musicFolder, setMusicFolder] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const bgCoverUrl = useCoverArt(playlist.currentTrack?.path);

  useEffect(() => {
    getCurrentWindow().show();
    api.getConfig().then((c) => {
      setMusicFolder(c.music_folder);
      api.setVolume(c.volume);
      playlist.setShuffle(c.shuffle);
      playlist.setRepeat(c.repeat ?? "off");
      playlist.loadLibrary(c.music_folder);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return playlist.tracks;
    const q = searchQuery.toLowerCase();
    return playlist.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q),
    );
  }, [playlist.tracks, searchQuery]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") {
        setMusicFolder(selected);
        // Show loading state while loading library
        await playlist.loadLibrary(selected);
        // Wait for library to load before saving config
        await api.setConfig({
          music_folder: selected,
          volume: playlist.volume,
          shuffle: playlist.shuffle,
          repeat: playlist.repeat,
          last_track_index: null,
          last_position: 0,
        });
      }
    } catch (error) {
      // Handle error - could show a toast or set error state
      console.error("Failed to select folder:", error);
      // Optionally set an error state in the playlist hook if needed
    }
  }, [playlist.volume, playlist.shuffle, playlist.repeat, playlist.loadLibrary]);

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
    { key: "KeyS", action: playlist.toggleShuffle, description: "Toggle shuffle" },
    { key: "KeyR", action: playlist.cycleRepeat, description: "Cycle repeat" },
  ]);

  const mediaActions = useMemo(
    () => ({
      onPlay: playlist.resume,
      onPause: playlist.pause,
      onNext: playlist.next,
      onPrevious: playlist.previous,
      onSeek: playlist.seek,
    }),
    [playlist.resume, playlist.pause, playlist.next, playlist.previous, playlist.seek],
  );

  useMediaSession(
    playlist.currentTrack,
    playlist.playing,
    playlist.position.current,
    mediaActions,
  );

  const content = (() => {
    switch (mode) {
      case "flow":
        return (
          <FlowView
            tracks={filteredTracks}
            currentTrack={playlist.currentTrack}
            playing={playlist.playing}
            position={playlist.positionValue}
            onSelect={playlist.playTrack}
            loading={playlist.loading}
          />
        );
      case "zen":
        return (
          <ZenView
            currentTrack={playlist.currentTrack}
            playing={playlist.playing}
            onExit={() => setMode("normal")}
            onToggle={playlist.toggle}
            onNext={playlist.next}
            onPrevious={playlist.previous}
          />
        );
      case "mini":
        return (
          <MiniView
            currentTrack={playlist.currentTrack}
            playing={playlist.playing}
            positionValue={playlist.positionValue}
            onToggle={playlist.toggle}
            onNext={playlist.next}
            onPrevious={playlist.previous}
            onSeek={playlist.seek}
            onExpand={() => setMode("normal")}
          />
        );
      default:
        return (
          <NormalView
            tracks={filteredTracks}
            currentTrack={playlist.currentTrack}
            onSelect={playlist.playTrack}
            loading={playlist.loading}
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
      currentTrack={playlist.currentTrack}
      playing={playlist.playing}
      volume={playlist.volume}
      shuffle={playlist.shuffle}
      repeat={playlist.repeat}
      positionValue={playlist.positionValue}
      error={playlist.error}
      onToggle={playlist.toggle}
      onNext={playlist.next}
      onPrevious={playlist.previous}
      onVolumeChange={playlist.setVolume}
      onSeek={playlist.seek}
      onToggleShuffle={playlist.toggleShuffle}
      onCycleRepeat={playlist.cycleRepeat}
      onClearError={playlist.clearError}
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
