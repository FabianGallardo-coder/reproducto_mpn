import type { Page } from "@playwright/test";
import type { YTPlayerLike, YTPlayerOptions } from "../../src/lib/youtubeIframeApi";

declare global {
  interface Window {
    __YOUTUBE_QA__?: {
      videoId: string;
      volume: number;
      position: number;
      state: number;
      created: number;
      stopped: number;
      finish(): void;
      fail(code: number): void;
    };
  }
}

/** Simulates the IFrame API, not actual YouTube playback. Live checks run separately in WebView2. */
export async function mockYouTube(page: Page) {
  await page.addInitScript(() => {
    const state = {
      videoId: "", volume: 0, position: 0, state: -1, created: 0, stopped: 0,
      finish: () => {}, fail: (_code: number) => {},
    };
    window.__YOUTUBE_QA__ = state;
    class Player implements YTPlayerLike {
      private frame: HTMLIFrameElement;
      private lastStarted = 0;
      constructor(element: HTMLElement, private options: YTPlayerOptions) {
        state.created++;
        state.videoId = options.videoId ?? "";
        this.frame = document.createElement("iframe");
        this.frame.title = "Simulated YouTube player";
        this.frame.style.cssText = "width:100%;height:100%;border:0";
        element.replaceWith(this.frame);
        state.finish = () => this.change(0);
        state.fail = (code) => options.events?.onError?.({ target: this, data: code });
        setTimeout(() => {
          options.events?.onReady?.({ target: this, data: 0 });
          if (options.playerVars?.autoplay) this.playVideo();
        }, 20);
      }
      private change(value: number) {
        state.position = this.getCurrentTime();
        state.state = value;
        this.lastStarted = Date.now();
        this.options.events?.onStateChange?.({ target: this, data: value });
      }
      playVideo() { this.change(1); }
      pauseVideo() { this.change(2); }
      stopVideo() { state.stopped++; this.change(2); }
      seekTo(seconds: number) { state.position = seconds; this.lastStarted = Date.now(); }
      setVolume(volume: number) { state.volume = volume; }
      getCurrentTime() { return state.position + (state.state === 1 ? (Date.now() - this.lastStarted) / 1000 : 0); }
      getDuration() { return 120; }
      getPlayerState() { return state.state; }
      loadVideoById({ videoId }: { videoId: string }) {
        state.videoId = videoId;
        state.position = 0;
        this.lastStarted = Date.now();
        this.playVideo();
      }
      cueVideoById({ videoId }: { videoId: string }) { state.videoId = videoId; this.change(5); }
      destroy() { state.state = -1; this.frame.remove(); }
    }
    window.YT = {
      Player,
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    };
  });
}
