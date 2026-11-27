import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/* Minimal typing for the YouTube IFrame API we use. */
interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export interface YouTubeHandle {
  /** current playback position in seconds (0 if not ready) */
  time(): number;
  seek(seconds: number, play?: boolean): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
}

/**
 * YouTube player controllable from React (seek without reloading the iframe,
 * read the current time). Used for video-synced goal logging and the timeline.
 */
const YouTubePlayer = forwardRef<YouTubeHandle, { videoId: string; className?: string; start?: number }>(function YouTubePlayer(
  { videoId, className, start },
  ref
) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadApi().then(() => {
      if (cancelled || !host.current || !window.YT) return;
      const el = document.createElement("div");
      host.current.innerHTML = "";
      host.current.appendChild(el);
      player.current = new window.YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: start ? Math.floor(start) : undefined },
        events: { onReady: () => !cancelled && setReady(true) },
      });
    });
    return () => {
      cancelled = true;
      try {
        player.current?.destroy();
      } catch {
        /* already gone */
      }
      player.current = null;
      setReady(false);
    };
  }, [videoId, start]);

  useImperativeHandle(ref, () => ({
    time: () => (ready && player.current ? player.current.getCurrentTime() : 0),
    seek: (s, play = true) => {
      if (!player.current) return;
      player.current.seekTo(s, true);
      if (play) player.current.playVideo();
    },
    play: () => player.current?.playVideo(),
    pause: () => player.current?.pauseVideo(),
    isPlaying: () => !!player.current && window.YT != null && player.current.getPlayerState() === window.YT.PlayerState.PLAYING,
  }), [ready]);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className ?? ""}`}>
      <div ref={host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {!ready && <div className="absolute inset-0 animate-pulse bg-white/5" aria-hidden />}
    </div>
  );
});

export default YouTubePlayer;
