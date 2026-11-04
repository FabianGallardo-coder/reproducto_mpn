export interface YTPlayerLike {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  destroy(): void;
}

export interface YTPlayerEvent {
  target: YTPlayerLike;
  data: number;
}

export interface YTPlayerOptions {
  videoId?: string;
  host?: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent) => void;
    onError?: (event: YTPlayerEvent) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayerLike;
  PlayerState: { UNSTARTED: number; ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_API_SRC = "https://www.youtube.com/iframe_api";

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the official IFrame Player API once; concurrent callers share the same promise. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("El reproductor de YouTube no está disponible."));
    };

    const script = document.createElement("script");
    script.src = YOUTUBE_API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      script.remove();
      reject(new Error("No se pudo cargar el reproductor de YouTube. Revisá tu conexión."));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export function resetYouTubeApiForTests(): void {
  apiPromise = null;
}

/** Documented embedded-player error codes mapped to a Spanish explanation. */
export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "YouTube rechazó el identificador del video.";
    case 5:
      return "YouTube no pudo reproducir este video en el reproductor integrado.";
    case 100:
      return "El video ya no existe o es privado.";
    case 101:
    case 150:
      return "El propietario no permite reproducir este video fuera de YouTube.";
    case 153:
      return "YouTube no aceptó el origen de la aplicación para reproducir este video.";
    default:
      return "No se pudo reproducir el video con el reproductor de YouTube.";
  }
}
