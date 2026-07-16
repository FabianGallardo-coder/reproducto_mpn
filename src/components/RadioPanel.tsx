import { useState, useEffect, useCallback } from "react";
import { api, type RadioStation } from "../lib/api";

interface Props {
  onPlay: (url: string) => void;
}

export function RadioPanel({ onPlay }: Props) {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      onPlay(station.url);
    },
    [onPlay],
  );

  if (loading) {
    return <div className="radio-panel">Loading stations...</div>;
  }

  if (error) {
    return <div className="radio-panel">Failed to load stations</div>;
  }

  return (
    <div className="radio-panel">
      <h3 className="radio-panel__title">Radio</h3>
      <ul className="radio-panel__list">
        {stations.map((s, index) => (
          <li key={`${s.url}-${index}`} className="radio-panel__item">
            <button
              className="radio-panel__station"
              onClick={() => handlePlay(s)}
              title={s.description}
            >
              <span className="radio-panel__name">{s.name}</span>
              <span className="radio-panel__genre">{s.genre}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
