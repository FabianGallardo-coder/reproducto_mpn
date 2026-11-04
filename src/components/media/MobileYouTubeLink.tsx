import { useState, type FormEvent } from "react";
import { usePlayerActions } from "../../hooks/usePlayerStore";
import { youtubeIdFromUrl } from "../../types/youtube";

export function MobileYouTubeLink() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { playYouTube } = usePlayerActions();
  const open = async (event: FormEvent) => {
    event.preventDefault();
    const id = youtubeIdFromUrl(url);
    if (!id) {
      setError("Ingresá un enlace de video válido de youtube.com o youtu.be.");
      return;
    }
    try {
      await playYouTube({ id, title: "Video de YouTube", artist: "YouTube", duration: 0, available: true });
      setError(null);
    } catch (reason) {
      console.error("Could not open YouTube link", reason);
      setError(String(reason));
    }
  };
  return (
    <form className="mobile-youtube-link" onSubmit={(event) => void open(event)}>
      <label htmlFor="mobile-youtube-url">Abrir enlace de YouTube</label>
      <input id="mobile-youtube-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
      <button className="button" type="submit">Reproducir video</button>
      <p>El video se mantiene visible y se pausa al ocultar la app. Sin descargas. La búsqueda integrada requiere una API oficial configurada.</p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
