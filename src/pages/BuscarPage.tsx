import { useEffect, useMemo, useState } from "react";
import "../styles/pages/buscar.css";
import { Chip, EmptyState, Page, Section } from "../components/ui/Page";
import { DownloadIcon, PlayIcon, SearchIcon } from "../components/ui/Icons";
import { MediaRow } from "../components/media/MediaItems";
import { api } from "../lib/api";
import { useNavigation } from "../hooks/useNavigation";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { usePlayAnyTrack } from "../hooks/usePlayAnyTrack";
import { usePlayerActions, usePlayerState } from "../hooks/usePlayerStore";
import { classifyYouTubeInput, youtubeItemTrack, youtubeWatchUrl, type YouTubeItem } from "../types/youtube";
import type { RadioStation, Track } from "../types";
import type { PageProps } from "./pageTypes";
import { isAndroid } from "../lib/platform";
import { MobileYouTubeLink } from "../components/media/MobileYouTubeLink";

type Scope = "todo" | "local" | "youtube" | "radio";

const SCOPES: ReadonlyArray<{ id: Scope; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "local", label: "Local" },
  { id: "youtube", label: "YouTube" },
  { id: "radio", label: "Radio" },
];

const PREVIEW = { local: 6, radio: 4, youtube: 8 } as const;
const MIN_QUERY = 2;

const matches = (query: string, ...fields: string[]) => {
  const needle = query.toLocaleLowerCase();
  return fields.some((field) => field.toLocaleLowerCase().includes(needle));
};

export function BuscarPage({ controls }: PageProps) {
  void controls;
  const { params } = useNavigation();
  const { tracks, currentTrack } = usePlayerState();
  const { playCollection, playYouTube } = usePlayerActions();
  const play = usePlayAnyTrack();
  const { isOnline } = useOnlineStatus();
  const [input, setInput] = useState(params.query ?? "");
  const [query, setQuery] = useState((params.query ?? "").trim());
  const [scope, setScope] = useState<Scope>("todo");
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [videos, setVideos] = useState<YouTubeItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    api.listRadioStations().then(setStations).catch((error) => {
      setRadioError(`No se pudieron cargar las emisoras: ${String(error)}`);
    });
  }, []);

  const wantsVideos = !isAndroid && (scope === "todo" || scope === "youtube") && query.length >= MIN_QUERY && isOnline;

  useEffect(() => {
    if (!wantsVideos) {
      setVideos([]);
      setHasMore(false);
      setVideoError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setVideoError(null);
    const link = classifyYouTubeInput(query);
    if (link.kind === "invalid") {
      setVideos([]);
      setHasMore(false);
      setSearching(false);
      setVideoError("Pegá un enlace de video o playlist de YouTube.");
      return;
    }
    const timer = setTimeout(() => {
      const request = link.kind === "video"
        ? api.youtubeInspect(youtubeWatchUrl(link.id) ?? query, false).then((collection) => collection.items)
        : link.kind === "playlist"
          ? api.youtubeInspect(link.url, true).then((collection) => collection.items.filter((item) => item.available))
          : api.youtubeSearch(query, 1);
      request
        .then((found) => {
          if (cancelled) return;
          setVideos(found);
          setPage(1);
          setHasMore(link.kind === "text" && found.length === 20);
        })
        .catch((error) => {
          if (!cancelled) setVideoError(String(error));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, wantsVideos]);

  const loadMore = async () => {
    setSearching(true);
    try {
      const next = page + 1;
      const found = await api.youtubeSearch(query, next);
      setVideos((previous) => [...previous, ...found]);
      setPage(next);
      setHasMore(found.length === 20 && next < 10);
    } catch (error) {
      setVideoError(String(error));
    } finally {
      setSearching(false);
    }
  };

  const download = async (item: YouTubeItem) => {
    setConfirming(null);
    try {
      await api.youtubeEnqueue({ id: item.id, title: item.title, items: [item], playlist: false });
      setStatus(`«${item.title}» se agregó a la cola de descargas.`);
    } catch (error) {
      setVideoError(String(error));
    }
  };

  const localMatches = useMemo(
    () => (query.length >= MIN_QUERY ? tracks.filter((track) => matches(query, track.title, track.artist, track.album)) : []),
    [tracks, query],
  );
  const stationMatches = useMemo(
    () => (query.length >= MIN_QUERY ? stations.filter((station) => matches(query, station.name, station.genre)) : []),
    [stations, query],
  );

  const showLocal = scope === "todo" || scope === "local";
  const showRadio = scope === "todo" || scope === "radio";
  const showVideos = scope === "todo" || scope === "youtube";
  const limit = (kind: keyof typeof PREVIEW) => (scope === "todo" ? PREVIEW[kind] : Infinity);
  const visibleLocal = localMatches.slice(0, limit("local"));
  const visibleStations = stationMatches.slice(0, limit("radio"));
  const visibleVideos = videos.slice(0, limit("youtube"));
  const total = (showLocal ? localMatches.length : 0) + (showRadio ? stationMatches.length : 0) + (showVideos ? videos.length : 0);
  const stationTrack = (station: RadioStation): Track => ({
    path: station.url,
    title: station.name,
    artist: station.genre || "Radio",
    album: "Internet Radio",
    duration: 0,
  });

  return (
    <Page name="buscar" title="Buscar" subtitle="Tu biblioteca, YouTube y radio en un solo lugar.">
      <div className="search__bar">
        <SearchIcon size={18} className="search__icon" />
        <input
          type="search"
          className="search__input"
          aria-label="Buscar música"
          placeholder="¿Qué querés escuchar?…"
          value={input}
          autoFocus={!isAndroid}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setInput(event.target.value)}
        />
      </div>
      <div className="chip-row" role="group" aria-label="Dónde buscar">
        {SCOPES.map((entry) => (
          <Chip key={entry.id} active={scope === entry.id} onClick={() => setScope(entry.id)}>{entry.label}</Chip>
        ))}
      </div>
      {status && <p className="search__status" role="status">{status}</p>}
      {showRadio && radioError && <p className="search__error" role="alert">{radioError}</p>}
      {!isOnline && showVideos && <p className="search__status" role="status">Sin conexión: solo se busca en tu biblioteca y emisoras.</p>}

      {isAndroid && scope === "youtube" ? null : query.length < MIN_QUERY ? (
        <EmptyState icon={<SearchIcon size={40} />} title="Buscá en toda tu música" description="Escribí al menos dos letras para ver resultados." />
      ) : (
        <>
          <p className="search__status" role="status">
            {searching ? "Buscando…" : `${total} ${total === 1 ? "resultado" : "resultados"} para «${query}»`}
          </p>

          {showLocal && visibleLocal.length > 0 && (
            <Section
              id="local"
              title="En tu biblioteca"
              action={scope === "todo" && localMatches.length > visibleLocal.length ? <button type="button" className="button" onClick={() => setScope("local")}>Ver todo</button> : undefined}
            >
              {visibleLocal.map((track) => (
                <MediaRow
                  key={track.path}
                  track={track}
                  active={currentTrack?.path === track.path}
                  onPlay={() => void playCollection(localMatches, localMatches.indexOf(track))}
                />
              ))}
            </Section>
          )}
          {showVideos && (visibleVideos.length > 0 || videoError) && (
            <Section
              id="youtube"
              title="En YouTube"
              action={scope === "todo" && videos.length > visibleVideos.length ? <button type="button" className="button" onClick={() => setScope("youtube")}>Ver todo</button> : undefined}
            >
              {videoError && <p className="search__error" role="alert">{videoError}</p>}
              {visibleVideos.map((item, index) => (
                <MediaRow
                  key={`${item.id}-${index}`}
                  track={youtubeItemTrack(item)}
                  active={currentTrack?.path === youtubeItemTrack(item).path}
                  onPlay={() => void playYouTube(item, videos)}
                  actions={
                    confirming === item.id ? (
                      <>
                        <button type="button" className="button button--primary" onClick={() => void download(item)}>Confirmar descarga</button>
                        <button type="button" className="button" onClick={() => setConfirming(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="icon-button"
                        disabled={!item.available}
                        aria-label={`Descargar ${item.title}`}
                        title="Descargar (solo material propio o autorizado)"
                        onClick={() => setConfirming(item.id)}
                      >
                        <DownloadIcon size={16} />
                      </button>
                    )
                  }
                />
              ))}
              {scope === "youtube" && hasMore && (
                <button type="button" className="button" disabled={searching} onClick={() => void loadMore()}>Ver más</button>
              )}
              <p className="search__hint">Descargá solo material propio o autorizado. Los videos se reproducen con el reproductor oficial de YouTube.</p>
            </Section>
          )}

          {showRadio && visibleStations.length > 0 && (
            <Section id="radio" title="Radio">
              {visibleStations.map((station) => (
                <MediaRow
                  key={station.url}
                  track={stationTrack(station)}
                  onPlay={() => void play(stationTrack(station))}
                  actions={<PlayIcon size={14} className="search__play" />}
                />
              ))}
            </Section>
          )}

          {!searching && total === 0 && (
            <EmptyState
              icon={<SearchIcon size={40} />}
              title="Sin resultados"
              description="Probá con otro nombre o ampliá la búsqueda a todas las fuentes."
              action={scope !== "todo" ? <button type="button" className="button" onClick={() => setScope("todo")}>Buscar en todo</button> : undefined}
            />
          )}
        </>
      )}
      {isAndroid && showVideos && <MobileYouTubeLink />}
    </Page>
  );
}
