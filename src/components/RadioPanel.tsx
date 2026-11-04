import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { RadioStation } from "../types";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { usePlayerActions } from "../hooks/usePlayerStore";
import type { Track } from "../types";

interface Props {
  onPlay: (track: Track) => void;
  query?: string;
}

export function RadioPanel({ onPlay, query = "" }: Props) {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { isOnline } = useOnlineStatus();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationUrl, setNewStationUrl] = useState("");
  const [newStationGenre, setNewStationGenre] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { addCustomRadio } = usePlayerActions();

  useEffect(() => {
    api.listRadioStations().then((s) => {
      setStations(s);
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, []);

  const handlePlay = useCallback(
    (station: RadioStation) => {
      onPlay({
        path: station.url,
        title: station.name,
        artist: station.genre || "Radio",
        album: "Internet Radio",
        duration: 0,
      });
    },
    [onPlay],
  );

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim() || !newStationUrl.trim()) return;
    const newStation: RadioStation = {
      name: newStationName.trim(),
      url: newStationUrl.trim(),
      genre: newStationGenre.trim() || "Personalizada",
      description: "Emisora agregada por el usuario",
    };
    setFormError(null);
    try {
      await addCustomRadio(newStation);
      const updatedStations = await api.listRadioStations();
      setStations(updatedStations);
      setNewStationName("");
      setNewStationUrl("");
      setNewStationGenre("");
      setShowAddForm(false);
    } catch (err) {
      setFormError(`No se pudo agregar la emisora: ${String(err).slice(0, 120)}`);
    }
  };

  if (loading) {
    return (
      <div className="radio-panel__loading" role="status" aria-live="polite">
        Cargando emisoras…
      </div>
    );
  }

  if (error) {
    return (
      <div className="radio-panel__error" role="alert" aria-live="assertive">
        No se pudieron cargar las emisoras
      </div>
    );
  }

  const filtered = stations.filter((s) => `${s.name} ${s.genre}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <div className="radio-panel">
      <div className="radio-panel__header">
        <h3 className="radio-panel__title">Radio</h3>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setFormError(null);
          }}
          className="radio-panel__add-btn"
        >
          {showAddForm ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddStation} className="radio-panel__form">
          <input
            type="text"
            placeholder="Nombre de la emisora…"
            aria-label="Nombre de la emisora"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            className="radio-panel__input"
            required
          />
          <input
            type="url"
            placeholder="URL de la emisora (http/https)…"
            aria-label="URL de la transmisión"
            value={newStationUrl}
            onChange={(e) => setNewStationUrl(e.target.value)}
            className="radio-panel__input"
            required
          />
          <input
            type="text"
            placeholder="Género (opcional)…"
            aria-label="Género de la emisora"
            value={newStationGenre}
            onChange={(e) => setNewStationGenre(e.target.value)}
            className="radio-panel__input"
          />
          <button
            type="submit"
            className="radio-panel__save-btn"
          >
            Guardar emisora
          </button>
          {formError && (
            <p className="radio-panel__error" role="alert" aria-live="assertive">
              {formError}
            </p>
          )}
        </form>
      )}

      {!isOnline && (
        <div className="radio-panel__offline" role="status" aria-live="polite">
          Sin conexión: las emisoras no están disponibles.
        </div>
      )}
      <p className="source-count" aria-live="polite">{filtered.length} emisoras</p>
      {stations.length === 0 ? (
        <p className="radio-panel__empty" role="status">
          Todavía no hay emisoras. Agregá una para empezar.
        </p>
      ) : (
        <ul className="radio-panel__list">
          {!filtered.length && <li className="source-empty">No hay emisoras que coincidan con tu búsqueda.</li>}
          {filtered.map((s, index) => (
            <li key={`${s.url}-${index}`} className="radio-panel__item">
              <button
                className="radio-panel__station"
                aria-label={`Reproducir radio ${s.name}`}
                onClick={() => handlePlay(s)}
                title={s.description}
                disabled={!isOnline}
                aria-disabled={!isOnline}
              >
                <span className="radio-panel__name">{s.name}</span>
                <span className="radio-panel__genre">{s.genre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
