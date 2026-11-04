import { useMemo } from "react";
import "../styles/pages/inicio.css";
import { EmptyState, Page, Section } from "../components/ui/Page";
import { HeartIcon, HomeIcon, PlayIcon } from "../components/ui/Icons";
import { MediaCard, MediaRow } from "../components/media/MediaItems";
import { useNavigation } from "../hooks/useNavigation";
import { usePlayHistory } from "../hooks/usePlayHistory";
import { usePlayAnyTrack } from "../hooks/usePlayAnyTrack";
import { usePlayerActions, usePlayerState } from "../hooks/usePlayerStore";
import type { Track } from "../types";
import type { PageProps } from "./pageTypes";

const QUICK_PICKS = 12;
const RECENT = 12;

export function greeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function InicioPage({ controls }: PageProps) {
  const { tracks, favorites, customPlaylists, currentTrack } = usePlayerState();
  const { toggleFavorite, playCollection } = usePlayerActions();
  const { navigate } = useNavigation();
  const { entries } = usePlayHistory();
  const play = usePlayAnyTrack();

  const recent = useMemo<Track[]>(() => {
    const seen = new Set<string>();
    const result: Track[] = [];
    for (const entry of entries) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      result.push({ path: entry.path, title: entry.title, artist: entry.artist, album: entry.album, duration: entry.duration });
      if (result.length === RECENT) break;
    }
    return result;
  }, [entries]);

  const quickPicks = useMemo<Track[]>(() => {
    const favorite = tracks.filter((track) => favorites.includes(track.path));
    const rest = tracks.filter((track) => !favorites.includes(track.path));
    return [...favorite, ...rest].slice(0, QUICK_PICKS);
  }, [tracks, favorites]);

  const shortcuts = [
    { id: "favoritos", label: "Favoritos", detail: `${favorites.length} canciones`, open: () => navigate("biblioteca", { section: "favoritos" }) },
    { id: "descargas", label: "Descargas de YouTube", detail: "Tu música guardada", open: () => navigate("biblioteca", { section: "descargas" }) },
    { id: "radio", label: "Radio", detail: "Emisoras en línea", open: () => navigate("biblioteca", { section: "radio" }) },
    ...customPlaylists.map((playlist) => ({
      id: `playlist-${playlist.name}`,
      label: playlist.name,
      detail: `${playlist.tracks.length} canciones`,
      open: () => navigate("biblioteca", { section: "playlist", playlist: playlist.name }),
    })),
  ];

  const empty = !tracks.length && !recent.length;

  return (
    <Page name="inicio" title={greeting(new Date().getHours())} subtitle="Retomá donde lo dejaste.">
      {empty ? (
        <EmptyState
          icon={<HomeIcon size={40} />}
          title="Tu música, a un clic"
          description="Elegí una carpeta con tus canciones o buscá algo en YouTube."
          action={
            <div className="page__actions">
              <button type="button" className="button button--primary" onClick={controls.onSelectFolder}>Elegir carpeta</button>
              <button type="button" className="button" onClick={() => navigate("buscar")}>Buscar música</button>
            </div>
          }
        />
      ) : (
        <>
          <Section id="shortcuts" title="Accesos directos">
            <div className="home__shortcuts">
              {shortcuts.map((shortcut) => (
                <button key={shortcut.id} type="button" className="home__shortcut" onClick={shortcut.open}>
                  <span className="home__shortcut-title">{shortcut.label}</span>
                  <span className="home__shortcut-detail">{shortcut.detail}</span>
                </button>
              ))}
            </div>
          </Section>

          {recent.length > 0 && (
            <Section id="recent" title="Volver a escuchar">
              <div className="home__scroller" role="list">
                {recent.map((track) => (
                  <div key={track.path} role="listitem">
                    <MediaCard track={track} onPlay={() => void play(track, recent)} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {quickPicks.length > 0 && (
            <Section
              id="quick"
              title="Selecciones rápidas"
              action={
                <button type="button" className="button" onClick={() => void playCollection(quickPicks, 0)}>
                  <PlayIcon size={12} /> Reproducir todo
                </button>
              }
            >
              <ol className="home__grid">
                {quickPicks.map((track, index) => {
                  const favorite = favorites.includes(track.path);
                  return (
                    <li key={track.path}>
                      <MediaRow
                        track={track}
                        index={index + 1}
                        active={currentTrack?.path === track.path}
                        onPlay={() => void playCollection(quickPicks, index)}
                        actions={
                          <button
                            type="button"
                            className={`icon-button ${favorite ? "icon-button--on" : ""}`}
                            aria-pressed={favorite}
                            aria-label={favorite ? `Quitar ${track.title} de favoritos` : `Agregar ${track.title} a favoritos`}
                            onClick={() => void toggleFavorite(track.path)}
                          >
                            <HeartIcon size={16} filled={favorite} />
                          </button>
                        }
                      />
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}
