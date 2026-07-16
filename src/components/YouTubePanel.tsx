import { useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

interface Props {
  onPlay: (url: string) => void;
}

export function YouTubePanel({ onPlay }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Clear success message after 3 seconds
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      console.log("Attempting to get YouTube stream URL for:", trimmed); // Debug log
      const streamUrl = await api.youtubeStreamUrl(trimmed);
      console.log("Received stream URL:", streamUrl); // Debug log
      if (streamUrl) {
        onPlay(streamUrl);
        setUrl("");
        setSuccess("¡Reproduciendo desde YouTube!");
      } else {
        setError("Could not get stream URL - empty response");
      }
    } catch (err) {
      console.error("YouTube API error:", err); // Debug log
      setError(String(err).slice(0, 80));
    } finally {
      setLoading(false);
    }
  }, [url, onPlay]);

  return (
    <div className="youtube-panel">
      <h3 className="youtube-panel__title">YouTube</h3>
      <form className="youtube-panel__form" onSubmit={handleSubmit}>
        <input
          type="url"
          className="youtube-panel__input"
          placeholder="Paste YouTube URL..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); setSuccess(null); }}
          disabled={loading}
        />
        <button
          type="submit"
          className="youtube-panel__btn"
          disabled={loading || !url.trim()}
        >
          {loading ? "..." : "Play"}
        </button>
      </form>
      {success && <div className="youtube-panel__success">{success}</div>}
      {error && <div className="youtube-panel__error">{error}</div>}
    </div>
  );
}
