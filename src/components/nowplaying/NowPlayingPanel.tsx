import { useState, type KeyboardEvent } from "react";
import { Lyrics } from "../Lyrics";
import { useAutoplay } from "../../lib/autoplay";
import { formatTime } from "../../lib/format";
import { usePlayerActions, usePlayerState } from "../../hooks/usePlayerStore";
import { trackYouTubeItem, youtubeIdFromPath, youtubeWatchUrl } from "../../types/youtube";
import { openExternal } from "../../lib/openExternal";
import { ExternalLinkIcon, MusicIcon } from "../ui/Icons";

type Tab = "cola" | "letra" | "detalles";
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "cola", label: "Cola" },
  { id: "letra", label: "Letra" },
  { id: "detalles", label: "Detalles" },
];

export function NowPlayingPanel() {
  const [tab, setTab] = useState<Tab>("cola");

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next =
      event.key === "ArrowRight" ? (index + 1) % TABS.length :
      event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length :
      event.key === "Home" ? 0 :
      event.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <aside className="nowplaying__panel" aria-label="Detalles de la reproducción">
      <div className="nowplaying__tabs" role="tablist" aria-label="Panel de reproducción" onKeyDown={move}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`nowplaying-tab-${entry.id}`}
            aria-controls="nowplaying-tabpanel"
            aria-selected={tab === entry.id}
            tabIndex={tab === entry.id ? 0 : -1}
            className={`nowplaying__tab ${tab === entry.id ? "nowplaying__tab--active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="nowplaying__tabpanel" id="nowplaying-tabpanel" role="tabpanel" aria-labelledby={`nowplaying-tab-${tab}`}>
        {tab === "cola" && <QueuePanel />}
        {tab === "letra" && <LyricsPanel />}
        {tab === "detalles" && <DetailsPanel />}
      </div>
    </aside>
  );
}

function QueuePanel() {
  const { queue, currentTrack } = usePlayerState();
  const { playCollection, playYouTube } = usePlayerActions();
  const [autoplay, setAutoplay] = useAutoplay();
  const index = queue.findIndex((track) => track.path === currentTrack?.path);
  const online = currentTrack ? youtubeIdFromPath(currentTrack.path) !== null : false;

  const play = (position: number) => {
    const target = queue[position];
    if (!target) return;
    if (online) {
      const items = queue.flatMap((track) => trackYouTubeItem(track) ?? []);
      const item = trackYouTubeItem(target);
      if (item) void playYouTube(item, items);
      return;
    }
    void playCollection(queue, position);
  };

  if (!queue.length) {
    return <p className="nowplaying__note">La cola está vacía. Elegí una canción para empezar.</p>;
  }

  return (
    <div className="nowplaying__queue">
      <div className="nowplaying__queue-head">
        <div>
          <p className="nowplaying__eyebrow">Reproduciendo desde</p>
          <p className="nowplaying__source">{online ? "YouTube" : currentTrack?.album || "Tu biblioteca"}</p>
        </div>
        <label className="switch">
          <span className="switch__label">Autoplay</span>
          <input
            type="checkbox"
            role="switch"
            className="switch__input"
            checked={autoplay}
            onChange={(event) => setAutoplay(event.target.checked)}
          />
          <span className="switch__track" aria-hidden="true" />
        </label>
      </div>
      <ol className="nowplaying__list" aria-label="Cola de reproducción">
        {queue.map((track, position) => {
          const active = position === index;
          return (
            <li key={`${track.path}-${position}`}>
              <button
                type="button"
                className={`nowplaying__item ${active ? "nowplaying__item--active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => play(position)}
              >
                <span className="nowplaying__index">{active ? <MusicIcon size={14} /> : position + 1}</span>
                <span className="nowplaying__item-text">
                  <span className="nowplaying__item-title">{track.title}</span>
                  <span className="nowplaying__item-artist">{track.artist}</span>
                </span>
                <span className="nowplaying__item-time">{track.duration > 0 ? formatTime(track.duration) : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LyricsPanel() {
  const { currentTrack, positionValue } = usePlayerState();
  if (!currentTrack) return <p className="nowplaying__note">No hay nada reproduciéndose.</p>;
  if (youtubeIdFromPath(currentTrack.path)) {
    return <p className="nowplaying__note">Las letras no están disponibles para videos reproducidos desde YouTube.</p>;
  }
  return (
    <div className="nowplaying__lyrics">
      <Lyrics
        artist={currentTrack.artist}
        title={currentTrack.title}
        album={currentTrack.album}
        duration={currentTrack.duration}
        position={positionValue}
      />
    </div>
  );
}

function DetailsPanel() {
  const { currentTrack } = usePlayerState();
  if (!currentTrack) return <p className="nowplaying__note">No hay nada reproduciéndose.</p>;
  const id = youtubeIdFromPath(currentTrack.path);
  const watchUrl = id ? youtubeWatchUrl(id) : null;
  const rows: Array<[string, string]> = [
    ["Título", currentTrack.title],
    ["Artista", currentTrack.artist || "Desconocido"],
    ["Álbum", currentTrack.album || "—"],
    ["Duración", currentTrack.duration > 0 ? formatTime(currentTrack.duration) : "—"],
    ["Fuente", id ? "YouTube (reproductor oficial)" : /^https?:\/\//i.test(currentTrack.path) ? "Radio en línea" : "Archivo local"],
  ];
  return (
    <div className="nowplaying__details">
      <dl className="nowplaying__facts">
        {rows.map(([label, value]) => (
          <div key={label} className="nowplaying__fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {watchUrl && (
        <button type="button" className="button" onClick={() => void openExternal(watchUrl)}>
          <ExternalLinkIcon size={14} /> Abrir en YouTube
        </button>
      )}
    </div>
  );
}
