import { useState, useEffect, useCallback, useMemo } from "react";
import { isAndroid, selectMedia } from "./lib/platform";
import { listen } from "@tauri-apps/api/event";
import { api } from "./lib/api";
import { usePlayerStore } from "./hooks/usePlayerStore";
import { useMode } from "./hooks/useMode";
import { useNavigation } from "./hooks/useNavigation";
import { useRecordPlays } from "./hooks/useRecordPlays";
import { useAccentColor } from "./hooks/useAccentColor";
import { shortcutsText } from "./lib/shortcuts";
import { useShortcuts } from "./hooks/useShortcuts";
import { useMediaSession } from "./hooks/useMediaSession";
import { useCoverArt } from "./lib/useCoverArt";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageRouter } from "./pages/PageRouter";
import { FlowView } from "./components/modes/flow/FlowView";
import { ZenView } from "./components/modes/zen/ZenView";
import { MiniView } from "./components/modes/mini/MiniView";

function App() {
  const player = usePlayerStore();
  const { mode, setMode } = useMode();
  const { navigate } = useNavigation();
  useRecordPlays();
  useAccentColor();
  const [musicFolder, setMusicFolder] = useState("");
  const bgCoverUrl = useCoverArt(player.currentTrack?.path);

  useEffect(() => {
    api.getConfig().then((c) => {
      setMusicFolder(c.music_folder);
      player.setVolume(c.volume);
      player.setShuffle(c.shuffle);
      player.setRepeat(c.repeat ?? "off");
      if (c.music_folder) player.loadLibrary(c.music_folder);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.setWindowMode(mode).catch((err) => {
      console.error("Failed to apply window mode:", err);
    });
  }, [mode]);

  useEffect(() => {
    const unlisten = listen("tray-show", () => {
      setMode((current) => (current === "zen" ? "normal" : current));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setMode]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await selectMedia(true);
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
          favorites: player.favorites ?? [],
          custom_playlists: player.customPlaylists ?? [],
          custom_radio_stations: player.customRadioStations ?? [],
        });
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      window.alert(`No se pudo abrir la carpeta de música:\n${String(error)}`);
    }
  }, [player.volume, player.shuffle, player.repeat, player.loadLibrary]);

  const handleOpenFile = useCallback(async () => {
    try {
      const selected = await selectMedia(false);
      if (typeof selected === "string") {
        await player.playExternalFile(selected);
      }
    } catch (error) {
      console.error("Failed to open file:", error);
      window.alert(`No se pudo abrir el archivo:\n${String(error)}`);
    }
  }, [player.playExternalFile]);

  const showAbout = useCallback(() => {
    window.alert(`FlowPlayer v0.1.0\nUn reproductor de música de escritorio construido con Tauri v2, Rust y React.`);
  }, []);

  const showShortcuts = useCallback(() => {
    window.alert(shortcutsText());
  }, []);

  useEffect(() => {
    const unlisteners = [
      listen("menu-open-folder", handleSelectFolder),
      listen("menu-open-file", handleOpenFile),
      listen("menu-about", showAbout),
      listen("menu-shortcuts", showShortcuts),
    ];
    return () => {
      unlisteners.forEach((u) => u.then((fn) => fn()));
    };
  }, [handleSelectFolder, handleOpenFile, showAbout, showShortcuts]);

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
    { key: "KeyO", ctrl: true, shift: true, action: handleOpenFile, description: "Open file" },
    { key: "KeyK", ctrl: true, action: () => { setMode("normal"); navigate("buscar"); }, description: "Search" },
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

  const libraryControls = useMemo(
    () => ({
      musicFolder,
      onSelectFolder: handleSelectFolder,
      onOpenFile: handleOpenFile,
      onShowShortcuts: showShortcuts,
      onShowAbout: showAbout,
    }),
    [musicFolder, handleSelectFolder, handleOpenFile, showShortcuts, showAbout],
  );

  const content = (() => {
    switch (mode) {
      case "flow":
        return (
          <FlowView
            tracks={player.tracks}
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
        return <PageRouter controls={libraryControls} />;
    }
  })();

  return (
    <>
      {mode !== "mini" && (
        <div className="app-bg">
          {bgCoverUrl && <img src={bgCoverUrl} alt="" className="app-bg__img" />}
        </div>
      )}
      {isAndroid && <span className="mobile-platform-note" role="note">Android de prueba · YouTube visible · audio local y radio en segundo plano</span>}
      <AppLayout mode={mode} onModeChange={setMode}>
        <ErrorBoundary>{content}</ErrorBoundary>
      </AppLayout>
    </>
  );
}

export default App;
