import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { usePlayerActions, usePlayerState } from "../hooks/usePlayerStore";
import type { Track } from "../types";
import { HeartIcon } from "./ui/Icons";

interface FavoriteEntry { track: Track; error?: string }
const key = (path: string) => path.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase();

export function FavoritesPanel({ query }: { query: string }) {
  const { favorites, tracks, currentTrack } = usePlayerState();
  const { playCollection, toggleFavorite } = usePlayerActions();
  const [entries, setEntries] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all(favorites.map(async (path): Promise<FavoriteEntry> => {
      const known = tracks.find((t) => key(t.path) === key(path));
      try {
        const metadata = await api.getTrackInfo(path);
        return { track: known ?? { ...metadata, path } };
      } catch (error) {
        return {
          track: known ?? { path, title: path.split(/[\\/]/).pop() ?? path, artist: "", album: "", duration: 0 },
          error: String(error),
        };
      }
    })).then((result) => {
      if (active) { setEntries(result); setLoading(false); }
    });
    return () => { active = false; };
  }, [favorites, tracks]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return entries.filter(({ track }) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(q));
  }, [entries, query]);
  const playable = entries.filter((entry) => !entry.error).map((entry) => entry.track);
  if (loading) return <p role="status">Cargando favoritos...</p>;
  if (!favorites.length) return <p className="source-empty">Marcá canciones con el corazón para encontrarlas acá.</p>;
  return <section aria-label="Canciones favoritas">
    <p className="source-count" role="status">{visible.length} favoritos</p>
    {!visible.length && <p className="source-empty">No hay favoritos que coincidan con tu búsqueda.</p>}
    <ul className="source-list">
      {visible.map(({ track, error }) => <li key={track.path} className="source-row">
        <button className={`source-track ${currentTrack && key(currentTrack.path) === key(track.path) ? "source-track--active" : ""}`}
          disabled={!!error} title={error ?? track.title}
          onClick={() => void playCollection(playable, playable.findIndex((t) => t.path === track.path))}>
          <strong>{track.title}</strong><span>{error ? "Archivo no disponible" : track.artist}</span>
        </button>
        <button className="source-heart" aria-label={`Quitar ${track.title} de favoritos`}
          onClick={() => void toggleFavorite(track.path)}><HeartIcon size={16} filled /></button>
      </li>)}
    </ul>
  </section>;
}
