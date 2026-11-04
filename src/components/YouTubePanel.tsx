import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/api";
import { usePlayerActions } from "../hooks/usePlayerStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { youtubeThumbnailUrl, youtubeTrack } from "../types/youtube";
import type { YouTubeCollection, YouTubeItem, YouTubeLibrary } from "../types/youtube";
import type { Track } from "../types";
import { MusicIcon } from "./ui/Icons";
import { formatTime } from "../lib/format";

interface Props { onPlay?: (track: Track) => void; query?: string }
const empty: YouTubeLibrary = { version: 1, songs: [], playlists: [], jobs: [] };

export function YouTubePanel({ query = "" }: Props) {
  const { playCollection, playYouTube } = usePlayerActions();
  const { isOnline } = useOnlineStatus();
  const [library, setLibrary] = useState<YouTubeLibrary>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [input, setInput] = useState("");
  const [includePlaylist, setIncludePlaylist] = useState(false);
  const [results, setResults] = useState<YouTubeItem[]>([]);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [selection, setSelection] = useState<YouTubeCollection | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [view, setView] = useState<"songs" | "playlists">("songs");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const mounted = useRef(false);
  const refreshRequest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++refreshRequest.current;
    try {
      const snapshot = await api.youtubeLibrary();
      if (mounted.current && request === refreshRequest.current) { setLibrary(snapshot); setLoading(false); }
    } catch (err) {
      if (mounted.current && request === refreshRequest.current) { setError(String(err)); setLoading(false); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const changed = listen("youtube-library-changed", () => void refresh());
    const failed = listen<string>("youtube-library-error", (event) => setError(event.payload));
    return () => {
      mounted.current = false;
      changed.then((stop) => stop()).catch(console.error);
      failed.then((stop) => stop()).catch(console.error);
    };
  }, [refresh]);

  // Library events drive refreshes; progress only needs a poll while a download is running.
  const hasActiveJobs = library.jobs.some((job) => job.entries.some((entry) => entry.status === "pending" || entry.status === "downloading"));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [hasActiveJobs, refresh]);

  const action = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await operation(); } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  };
  const findOnline = async (more = false) => action(async () => {
    const text = more ? searched : input.trim();
    if (!text) throw new Error("Ingresá una búsqueda o enlace de YouTube.");
    if (!more) {
      setSelection(null);
      setResults([]);
      setHasMore(false);
      setStatus("");
    }
    if (/^https?:\/\//i.test(text)) {
      setSelection(await api.youtubeInspect(text, includePlaylist));
      setResults([]);
    } else {
      const next = more ? page + 1 : 1;
      const found = await api.youtubeSearch(text, next);
      setResults((previous) => more ? [...previous, ...found] : found);
      setHasMore(found.length === 20 && next < 10);
      setPage(next);
      setSearched(text);
      if (!found.length) setStatus("No se encontraron resultados.");
    }
  });
  const download = () => action(async () => {
    if (!selection) return;
    await api.youtubeEnqueue(selection);
    setStatus("Descarga agregada a la cola. Tu reproducción no cambia.");
    setSelection(null);
    await refresh();
  });
  const q = query.trim().toLocaleLowerCase();
  const songs = library.songs.filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase().includes(q));
  const playlists = library.playlists.filter((p) => `${p.title} ${p.items.map((i) => `${i.title} ${i.artist}`).join(" ")}`.toLocaleLowerCase().includes(q));
  const selected = library.playlists.find((p) => p.id === detail);
  const playlistSongs = selected?.items.flatMap((item) => {
    const song = library.songs.find((s) => s.id === item.id && !s.missing);
    return song ? [song] : [];
  }) ?? [];
  return <section className="youtube-panel" aria-label="Biblioteca YouTube">
    <div className="source-heading"><h3>Descargas</h3>
      <button onClick={() => { setOnline(!online); setSelection(null); }}>
        {online ? "Cerrar búsqueda online" : "Agregar de YouTube"}
      </button>
    </div>
    {error && <div className="source-error" role="alert">{error}<button onClick={() => void refresh()}>Actualizar</button></div>}
    {status && <p role="status" className="source-count">{status}</p>}
    {loading && <p role="status">Cargando descargas...</p>}
    {!isOnline && <p role="status">Sin conexión: podés reproducir tus descargas completas.</p>}
    {online && <div className="youtube-online">
      <p className="source-count">Descargá solo material propio o autorizado.</p>
      <form onSubmit={(e) => { e.preventDefault(); void findOnline(); }}>
        <input className="source-search" type="search" aria-label="Buscar online en YouTube o pegar enlace"
          placeholder="Canción o enlace de YouTube..." value={input} onChange={(e) => setInput(e.target.value)} />
        <label className="source-checkbox"><input type="checkbox" checked={includePlaylist} onChange={(e) => setIncludePlaylist(e.target.checked)} />
          Incluir playlist del enlace</label>
        <button disabled={busy || !isOnline || !input.trim()} type="submit">{busy ? "Consultando..." : "Buscar / inspeccionar"}</button>
      </form>
      <ul className="source-list youtube-results">{results.map((item, index) => {
        const thumbnailUrl = youtubeThumbnailUrl(item.id);
        return <li className="source-row youtube-result" key={`${item.id}-${index}`}>
          <div className="youtube-result__art" aria-hidden="true">
            {thumbnailUrl
              ? <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" />
              : <MusicIcon size={18} />}
          </div>
          <button className="source-track" aria-label={`Descargar ${item.title}`} disabled={!item.available || busy}
            onClick={() => setSelection({ id: item.id, title: item.title, items: [item], playlist: false })}>
            <strong>{item.title}</strong><span>{item.artist} · {formatTime(item.duration)}</span>
          </button>
          {thumbnailUrl && <button className="youtube-result__open" type="button"
            onClick={() => void playYouTube(item, results)}
            aria-label={`Reproducir ${item.title} en YouTube`}>Reproducir</button>}
        </li>;
      })}</ul>
      {hasMore && <button disabled={busy || !isOnline} onClick={() => void findOnline(true)}>Más resultados</button>}
      {selection && <div className="youtube-confirm" aria-label="Confirmar descarga">
        <strong>{selection.title}</strong>
        <p>{selection.items.length} canciones · {selection.items.filter((i) => !i.available).length} no disponibles</p>
        <p>Se guardarán en los datos de FlowPlayer. No se reproducirán automáticamente.</p>
        {!selection.playlist && youtubeThumbnailUrl(selection.id) && <button type="button"
          onClick={() => void playYouTube(selection.items[0])}>Reproducir en FlowPlayer</button>}
        <button disabled={busy || !isOnline} onClick={() => void download()}>Confirmar descarga</button>
        <button onClick={() => setSelection(null)} disabled={busy}>Volver</button>
      </div>}
    </div>}
    <div className="source-view-switch" aria-label="Tipo de descargas">
      <button aria-pressed={view === "songs"} onClick={() => { setView("songs"); setDetail(null); }}>Canciones</button>
      <button aria-pressed={view === "playlists"} onClick={() => { setView("playlists"); setDetail(null); }}>Playlists</button>
    </div>
    {view === "songs" ? <>
      <p className="source-count" role="status">{songs.length} {songs.length === 1 ? "canción" : "canciones"}</p>
      {!songs.length && !loading && <p className="source-empty">{q ? "No hay descargas que coincidan." : "Todavía no hay canciones descargadas. Usá Agregar de YouTube."}</p>}
      <ul className="source-list">{songs.map((song) => <li key={song.id} className="source-row">
        <button className="source-track" aria-label={`Reproducir ${song.title}`} disabled={song.missing} onClick={() => {
          const playable = songs.filter((s) => !s.missing);
          void playCollection(playable.map(youtubeTrack), playable.findIndex((s) => s.id === song.id));
        }}><strong>{song.title}</strong><span>{song.missing ? "Archivo no disponible; volvé a descargarlo" : song.artist}</span></button>
      </li>)}</ul>
    </> : <>
      {!detail && <ul className="source-list">{playlists.map((p) => <li key={p.id} className="source-row">
        <button className="source-track" onClick={() => setDetail(p.id)}><strong>{p.title}</strong><span>{p.items.length} canciones</span></button>
      </li>)}</ul>}
      {!playlists.length && <p className="source-empty">{q ? "No hay playlists que coincidan." : "No hay playlists descargadas."}</p>}
      {selected && <>
        <button onClick={() => setDetail(null)}>Volver a playlists</button><h4>{selected.title}</h4>
        <button disabled={!playlistSongs.length} onClick={() => void playCollection(playlistSongs.map(youtubeTrack), 0)}>Reproducir playlist</button>
        <ol className="source-list">{selected.items.map((item, index) => {
          const song = library.songs.find((s) => s.id === item.id && !s.missing);
          return <li className="source-row" key={`${item.id}-${index}`}>
            <button className="source-track" disabled={!song}
              onClick={() => void playCollection(playlistSongs.map(youtubeTrack),
                selected.items.slice(0, index).filter((entry) => library.songs.some((s) => s.id === entry.id && !s.missing)).length)}>
              <strong>{index + 1}. {item.title}</strong><span>{song ? item.artist : "No disponible / pendiente de descarga"}</span>
            </button></li>;
        })}</ol>
      </>}
    </>}
    {!!library.jobs.length && <section className="download-jobs" aria-label="Trabajos de descarga"><h4>Descargas en segundo plano</h4>
      {library.jobs.map((job) => {
        const active = job.entries.some((e) => e.status === "pending" || e.status === "downloading");
        const failed = job.entries.some((e) => e.status === "failed" || e.status === "cancelled");
        const current = job.entries.find((e) => e.status === "downloading");
        return <div key={job.id} className="download-job">
          <strong>{job.title}</strong>
          <p>{job.entries.filter((e) => e.status === "complete").length}/{job.entries.length} completas
            {" · "}{job.entries.filter((e) => e.status === "failed").length} fallidas
            {" · "}{job.entries.filter((e) => e.status === "pending").length} pendientes
            {" · "}{job.entries.filter((e) => e.status === "cancelled").length} canceladas</p>
          {current && <><span>{current.item.title}</span><progress max={100} value={current.progress} aria-label={`Descargando ${current.item.title}`} /></>}
          {active && <button onClick={() => void action(async () => { await api.youtubeCancel(job.id); await refresh(); })}>Cancelar descarga</button>}
          {failed && !active && <button disabled={!isOnline} onClick={() => void action(async () => { await api.youtubeRetry(job.id); await refresh(); })}>Reintentar fallidos</button>}
          {job.entries.filter((e) => e.error).map((e, i) => <p className="source-error" key={`${e.item.id}-${i}`}>{e.item.title}: {e.error}</p>)}
        </div>;
      })}
    </section>}
  </section>;
}
