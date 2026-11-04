import { useEffect, useMemo, useRef, useState } from "react";
import { loadYouTubeApi, type YTPlayerLike } from "../lib/youtubeIframeApi";

export interface YouTubeController {
  play(): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  /** Volume in the 0..1 range. */
  setVolume(volume: number): void;
}

export interface YouTubePlayerOptions {
  videoId: string | null;
  autoplay: boolean;
  startSeconds: number;
  volume: number;
  onPlaying(playing: boolean): void;
  onProgress(position: number, duration: number): void;
  onEnded(): void;
  onError(code: number): void;
}

export type YouTubePlayerStatus = "idle" | "loading" | "ready" | "error";

const PROGRESS_INTERVAL_MS = 500;

export function useYouTubePlayer(options: YouTubePlayerOptions) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const readyRef = useRef(false);
  const loadedIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [status, setStatus] = useState<YouTubePlayerStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const { videoId, volume } = options;

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(() => {
      const player = playerRef.current;
      if (player && readyRef.current) optionsRef.current.onProgress(player.getCurrentTime(), player.getDuration());
    }, PROGRESS_INTERVAL_MS);
  };

  const destroy = () => {
    stopPolling();
    readyRef.current = false;
    loadedIdRef.current = null;
    try {
      playerRef.current?.destroy();
    } catch {
      // The iframe may already be gone; nothing else to release.
    }
    playerRef.current = null;
    mountRef.current?.replaceChildren();
  };

  useEffect(() => {
    if (!videoId) {
      destroy();
      setStatus("idle");
      return;
    }
    if (playerRef.current) {
      if (readyRef.current && loadedIdRef.current !== videoId) {
        loadedIdRef.current = videoId;
        playerRef.current.loadVideoById({ videoId });
      }
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setLoadError(null);
    loadYouTubeApi()
      .then((YT) => {
        const mount = mountRef.current;
        if (cancelled || !mount || playerRef.current) return;
        const target = document.createElement("div");
        mount.replaceChildren(target);
        loadedIdRef.current = videoId;
        playerRef.current = new YT.Player(target, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: optionsRef.current.autoplay ? 1 : 0,
            start: Math.max(0, Math.floor(optionsRef.current.startSeconds)),
            controls: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              readyRef.current = true;
              setStatus("ready");
              event.target.setVolume(Math.round(optionsRef.current.volume * 100));
            },
            onStateChange: (event) => {
              const states = YT.PlayerState;
              if (event.data === states.PLAYING) {
                optionsRef.current.onPlaying(true);
                startPolling();
              } else if (event.data === states.PAUSED) {
                optionsRef.current.onPlaying(false);
                stopPolling();
              } else if (event.data === states.ENDED) {
                stopPolling();
                optionsRef.current.onEnded();
              }
            },
            onError: (event) => {
              stopPolling();
              setStatus("error");
              optionsRef.current.onError(event.data);
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setLoadError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (status === "ready") playerRef.current?.setVolume(Math.round(volume * 100));
  }, [volume, status]);

  useEffect(() => destroy, []); // eslint-disable-line react-hooks/exhaustive-deps

  const controller = useMemo<YouTubeController>(
    () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      stop: () => playerRef.current?.stopVideo(),
      seek: (seconds) => playerRef.current?.seekTo(Math.max(0, seconds), true),
      setVolume: (value) => playerRef.current?.setVolume(Math.round(Math.min(1, Math.max(0, value)) * 100)),
    }),
    [],
  );

  return { mountRef, controller, status, loadError };
}
