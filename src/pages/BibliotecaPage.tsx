import { useMemo } from "react";
import { Page, Chip, EmptyState } from "../components/ui/Page";
import { LibraryIcon } from "../components/ui/Icons";
import { TrackList } from "../components/TrackList";
import { FavoritesPanel } from "../components/FavoritesPanel";
import { RadioPanel } from "../components/RadioPanel";
import { YouTubePanel } from "../components/YouTubePanel";
import { useNavigation, type LibrarySection } from "../hooks/useNavigation";
import { usePlayerActions, usePlayerState } from "../hooks/usePlayerStore";
import type { PageProps } from "./pageTypes";
import { isAndroid } from "../lib/platform";

const SECTIONS: ReadonlyArray<{ id: Exclude<LibrarySection, "playlist">; label: string }> = [
  { id: "pistas", label: "Pistas locales" },
  { id: "favoritos", label: "Favoritos" },
  { id: "descargas", label: "Descargas de YouTube" },
  { id: "radio", label: "Radio" },
];

export function BibliotecaPage({ controls }: PageProps) {
  const { params, navigate } = useNavigation();
  const { tracks, currentTrack, loading, scanProgress, customPlaylists } = usePlayerState();
  const { playTrack, playVirtualTrack, playCollection } = usePlayerActions();
  const section: LibrarySection = params.section ?? "pistas";

  const playlist = useMemo(() => customPlaylists.find((entry) => entry.name === params.playlist), [customPlaylists, params.playlist]);
  const playlistTracks = useMemo(
    () => (playlist ? tracks.filter((track) => playlist.tracks.includes(track.path)) : []),
    [playlist, tracks],
  );

  const title = section === "playlist" && playlist ? playlist.name : "Biblioteca";

  return (
    <Page
      name="biblioteca"
      title={title}
      subtitle={controls.musicFolder || "Todavía no elegiste una carpeta de música."}
      actions={
        <>
          <button type="button" className="button" onClick={controls.onSelectFolder}>Elegir carpeta</button>
          <button type="button" className="button" onClick={controls.onOpenFile}>Abrir archivo</button>
        </>
      }
    >
      <div className="chip-row" role="group" aria-label="Colecciones">
        {SECTIONS.map((entry) => (
          <Chip key={entry.id} active={section === entry.id} onClick={() => navigate("biblioteca", { section: entry.id })}>
            {entry.label}
          </Chip>
        ))}
      </div>

      {section === "pistas" && (
        tracks.length || loading ? (
          <div className="library__list">
            <p className="library__count" role="status">{tracks.length} canciones</p>
            <TrackList tracks={tracks} currentTrack={currentTrack} onSelect={playTrack} loading={loading} scanProgress={scanProgress} />
          </div>
        ) : (
          <EmptyState
            icon={<LibraryIcon size={40} />}
            title="No hay canciones todavía"
            description="Elegí una carpeta de música para escanearla."
            action={<button type="button" className="button button--primary" onClick={controls.onSelectFolder}>Elegir carpeta</button>}
          />
        )
      )}
      {section === "favoritos" && <div className="library__panel"><FavoritesPanel query="" /></div>}
      {section === "descargas" && <div className="library__panel">{isAndroid
        ? <p>Las descargas de YouTube no están disponibles en Android. Abrí un enlace desde Buscar para usar el reproductor oficial.</p>
        : <YouTubePanel onPlay={playVirtualTrack} query="" />}</div>}
      {section === "radio" && <div className="library__panel"><RadioPanel onPlay={playVirtualTrack} query="" /></div>}
      {section === "playlist" && (
        playlistTracks.length ? (
          <div className="library__list">
            <p className="library__count" role="status">{playlistTracks.length} canciones</p>
            <TrackList
              tracks={playlistTracks}
              currentTrack={currentTrack}
              onSelect={(track) => void playCollection(playlistTracks, playlistTracks.findIndex((entry) => entry.path === track.path))}
            />
          </div>
        ) : (
          <EmptyState
            icon={<LibraryIcon size={40} />}
            title="Esta playlist está vacía"
            description="Agregá canciones desde la biblioteca."
          />
        )
      )}
    </Page>
  );
}
