import { useMemo, useState } from "react";
import "../styles/pages/estadisticas.css";
import { Chip, EmptyState, Page, Section } from "../components/ui/Page";
import { ConfirmAction } from "../components/ui/ConfirmAction";
import { StatsIcon } from "../components/ui/Icons";
import { usePlayHistory } from "../hooks/usePlayHistory";
import { usePlayAnyTrack } from "../hooks/usePlayAnyTrack";
import { formatTime } from "../lib/format";
import {
  activityByDay,
  dayLabel,
  filterByRange,
  groupByDay,
  rangeDays,
  summarize,
  topArtists,
  topTracks,
  type StatsRange,
} from "../lib/stats";
import type { PlayHistoryEntry } from "../types/history";
import type { Track } from "../types";
import type { PageProps } from "./pageTypes";

const RANGES: ReadonlyArray<{ id: StatsRange; label: string }> = [
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "all", label: "Siempre" },
];

const numberFormat = new Intl.NumberFormat("es");
const timeFormat = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

function asTrack(entry: PlayHistoryEntry): Track {
  return { path: entry.path, title: entry.title, artist: entry.artist, album: entry.album, duration: entry.duration };
}

export function EstadisticasPage({ controls }: PageProps) {
  void controls;
  const { entries, loading, clear } = usePlayHistory();
  const play = usePlayAnyTrack();
  const [range, setRange] = useState<StatsRange>("7d");
  const now = Date.now();

  const scoped = useMemo(() => filterByRange(entries, range, now), [entries, range, now]);
  const summary = useMemo(() => summarize(scoped), [scoped]);
  const tracks = useMemo(() => topTracks(scoped, 10), [scoped]);
  const artists = useMemo(() => topArtists(scoped, 5), [scoped]);
  const activityDays = rangeDays(range) ?? 30;
  const activity = useMemo(() => activityByDay(scoped, activityDays, now), [scoped, activityDays, now]);
  const days = useMemo(() => groupByDay(scoped), [scoped]);
  const peak = Math.max(1, ...activity.map((day) => day.plays));
  const topArtistPlays = Math.max(1, ...artists.map((artist) => artist.plays));

  return (
    <Page
      name="estadisticas"
      title="Estadísticas"
      subtitle="Lo que escuchás, calculado solo con el historial guardado en este equipo."
      actions={
        <div className="chip-row" role="group" aria-label="Período">
          {RANGES.map((entry) => (
            <Chip key={entry.id} active={range === entry.id} onClick={() => setRange(entry.id)}>
              {entry.label}
            </Chip>
          ))}
        </div>
      }
    >
      {loading ? (
        <p className="stats__note" role="status">Cargando historial…</p>
      ) : !entries.length ? (
        <EmptyState
          icon={<StatsIcon size={40} />}
          title="Todavía no hay historial"
          description="Reproducí música y acá vas a ver qué escuchás más."
        />
      ) : (
        <>
          <section className="stats__cards" aria-label="Resumen">
            <article className="stats__card">
              <p className="stats__value">{numberFormat.format(summary.plays)}</p>
              <p className="stats__label">Reproducciones</p>
            </article>
            <article className="stats__card">
              <p className="stats__value">{numberFormat.format(summary.minutes)}</p>
              <p className="stats__label">Minutos escuchados*</p>
            </article>
            <article className="stats__card">
              <p className="stats__value">{numberFormat.format(summary.artists)}</p>
              <p className="stats__label">Artistas distintos</p>
            </article>
          </section>
          <p className="stats__note">* Aproximado: suma la duración completa de cada canción reproducida.</p>

          {!scoped.length ? (
            <EmptyState title="Sin reproducciones en este período" description="Probá con un rango más amplio." />
          ) : (
            <>
              <Section id="top-tracks" title="Más escuchadas">
                <ol className="stats__list">
                  {tracks.map((stat, index) => (
                    <li key={stat.path}>
                      <button type="button" className="stats__row" onClick={() => void play(asTrack(stat.latest))}>
                        <span className="stats__rank">{index + 1}</span>
                        <span className="stats__text">
                          <span className="stats__title">{stat.latest.title}</span>
                          <span className="stats__sub">{stat.latest.artist}</span>
                        </span>
                        <span className="stats__count">{stat.plays} {stat.plays === 1 ? "vez" : "veces"}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="top-artists" title="Artistas más escuchados">
                <ol className="stats__bars">
                  {artists.map((artist) => (
                    <li key={artist.artist} className="stats__bar-row">
                      <span className="stats__bar-name">{artist.artist}</span>
                      <span className="stats__bar-track" aria-hidden="true">
                        <span className="stats__bar-fill" style={{ width: `${(artist.plays / topArtistPlays) * 100}%` }} />
                      </span>
                      <span className="stats__count">{artist.plays}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section id="activity" title="Actividad">
                <div className="stats__chart" aria-hidden="true">
                  {activity.map((day) => (
                    <span key={day.key} className="stats__column" title={`${day.key}: ${day.plays}`}>
                      <span className="stats__column-fill" style={{ height: `${(day.plays / peak) * 100}%` }} />
                    </span>
                  ))}
                </div>
                <table className="visually-hidden">
                  <caption>Reproducciones por día</caption>
                  <thead>
                    <tr><th scope="col">Día</th><th scope="col">Reproducciones</th></tr>
                  </thead>
                  <tbody>
                    {activity.map((day) => (
                      <tr key={day.key}><th scope="row">{day.key}</th><td>{day.plays}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              <Section
                id="history"
                title="Historial"
                action={<ConfirmAction label="Borrar historial" confirmLabel="Sí, borrar todo" onConfirm={clear} />}
              >
                {days.map((group) => (
                  <div key={group.key} className="stats__day">
                    <h3 className="stats__day-title">{dayLabel(group.timestamp, now)}</h3>
                    <ul className="stats__list">
                      {group.entries.map((entry) => (
                        <li key={`${entry.path}-${entry.playedAt}`}>
                          <button type="button" className="stats__row" onClick={() => void play(asTrack(entry))}>
                            <span className="stats__rank stats__rank--time">{timeFormat.format(entry.playedAt)}</span>
                            <span className="stats__text">
                              <span className="stats__title">{entry.title}</span>
                              <span className="stats__sub">{entry.artist}</span>
                            </span>
                            <span className="stats__count">{entry.duration > 0 ? formatTime(entry.duration) : ""}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Section>
            </>
          )}
        </>
      )}
    </Page>
  );
}
