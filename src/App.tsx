import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "./lib/api";
import { useAudio } from "./hooks/useAudio";
import { useMode } from "./hooks/useMode";
import { useLibrary } from "./hooks/useLibrary";
import { useShortcuts } from "./hooks/useShortcuts";
import { AppLayout } from "./components/layout/AppLayout";
import { NormalView } from "./components/modes/normal/NormalView";
import { FlowView } from "./components/modes/flow/FlowView";
import { ZenView } from "./components/modes/zen/ZenView";

function App() {
  const audio = useAudio();
  const { mode, setMode, cycleMode } = useMode();
  const library = useLibrary();
  const [musicFolder, setMusicFolder] = useState("");

  useEffect(() => {
    api.getConfig().then((c) => {
      setMusicFolder(c.music_folder);
      api.setVolume(c.volume);
      library.scan(c.music_folder);
    });
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setMusicFolder(selected);
      library.scan(selected);
      api.setConfig({ music_folder: selected, volume: audio.volume, crossfade_duration: 3 });
    }
  }, [audio.volume]);

  useShortcuts([
    { key: "Space", action: audio.toggle, description: "Play/Pause" },
    { key: "KeyN", alt: true, action: () => setMode("normal"), description: "Normal mode" },
    { key: "KeyF", alt: true, action: () => setMode("flow"), description: "Flow mode" },
    { key: "KeyZ", alt: true, action: () => setMode("zen"), description: "Zen mode" },
    { key: "Tab", action: cycleMode, description: "Cycle modes" },
    { key: "ArrowRight", ctrl: true, action: audio.next, description: "Next track" },
    { key: "ArrowLeft", ctrl: true, action: audio.previous, description: "Previous track" },
    { key: "ArrowUp", ctrl: true, action: () => audio.setVolume(Math.min(1, audio.volume + 0.05)), description: "Volume up" },
    { key: "ArrowDown", ctrl: true, action: () => audio.setVolume(Math.max(0, audio.volume - 0.05)), description: "Volume down" },
    { key: "KeyO", ctrl: true, action: handleSelectFolder, description: "Open folder" },
  ]);

  const content = (() => {
    switch (mode) {
      case "flow":
        return (
          <FlowView
            tracks={library.tracks}
            currentTrack={audio.currentTrack}
            playing={audio.playing}
            onSelect={audio.play}
          />
        );
      case "zen":
        return <ZenView currentTrack={audio.currentTrack} playing={audio.playing} />;
      default:
        return <NormalView tracks={library.tracks} currentTrack={audio.currentTrack} onSelect={audio.play} />;
    }
  })();

  return (
    <AppLayout
      mode={mode}
      onModeChange={setMode}
      currentTrack={audio.currentTrack}
      playing={audio.playing}
      volume={audio.volume}
      onToggle={audio.toggle}
      onNext={audio.next}
      onPrevious={audio.previous}
      onVolumeChange={audio.setVolume}
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
