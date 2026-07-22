"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { TTS_SPEED_OPTIONS, snapTtsSpeedToOption } from "@/app/book/settings/constants/tts";
import {
  Headphones,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";

type AudioPlayerProps = {
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  tone: string;
  variant: string;
  // SET-2: the reader's persisted TTS playback speed (settings.extended.ttsSpeed).
  // Seeds the player's initial speed and keeps it in sync until the listener
  // adjusts speed here, at which point onSpeedChange persists their choice back.
  initialSpeed?: number;
  onSpeedChange?: (speed: number) => void;
};

export function AudioPlayer({
  bookId,
  chapterNumber,
  chapterTitle,
  tone,
  variant,
  initialSpeed,
  onSpeedChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const autoPlayedRef = useRef(false);
  const loadedParamsRef = useRef("");
  const knownDurationRef = useRef(0);
  // Render-readable mirror of loadedParamsRef. The ref stays the source of
  // truth for the synchronous cache guard in loadAudio and the forced-reload
  // handlers (which set it to "" *before* calling loadAudio); this state is
  // updated alongside every ref write so the "settings changed" prompt can be
  // derived during render without reading the ref (react-hooks/refs).
  const speedRef = useRef(1);
  // SET-2: once the listener picks a speed here, stop syncing from the persisted
  // pref (initialSpeed) so a late prefs hydration can't override their choice.
  const userAdjustedSpeedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(() =>
    typeof initialSpeed === "number" ? snapTtsSpeedToOption(initialSpeed) : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [loadedParams, setLoadedParams] = useState("");

  const paramsKey = `${bookId}:${chapterNumber}:${tone}:${variant}`;
  const audioMatchesCurrent = !audioReady || loadedParams === paramsKey;
  const audioUrl = `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audio?tone=${encodeURIComponent(tone)}&variant=${encodeURIComponent(variant)}`;

  // Keep a ref in sync so the audio-events effect (deps [open]) reads the
  // latest speed after each (re)load instead of a stale closure value. Also
  // push the rate onto the live element so an initialSpeed adoption (below)
  // takes effect mid-playback, not only on the next load.
  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // SET-2: adopt the listener's persisted TTS speed once prefs hydrate (state
  // seeds from defaults first, then localStorage / server settings arrive
  // async). Stops once they adjust speed here so their in-session choice wins.
  useEffect(() => {
    if (userAdjustedSpeedRef.current || typeof initialSpeed !== "number") return;
    setSpeed(snapTtsSpeedToOption(initialSpeed));
  }, [initialSpeed]);

  // ── Load audio ─────────────────────────────────────────────────────
  const loadAudio = useCallback(async () => {
    if (loadedParamsRef.current === paramsKey && audioReady) return;

    setLoading(true);
    setError(null);
    setAudioReady(false);
    setCurrentTime(0);
    setDuration(0);
    knownDurationRef.current = 0;
    autoPlayedRef.current = false;

    try {
      const res = await fetch(audioUrl);
      if (!res.ok) {
        let msg = "Failed to generate audio";
        try {
          const body = await res.json();
          msg = (body as { error?: { message?: string } })?.error?.message ?? msg;
        } catch {}
        setError(msg);
        setLoading(false);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();

      if (audioRef.current) {
        // Use MediaSource Extensions for seekable playback
        if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
          const mediaSource = new MediaSource();
          const msUrl = URL.createObjectURL(mediaSource);
          audioRef.current.src = msUrl;

          mediaSource.addEventListener("sourceopen", () => {
            try {
              const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
              sourceBuffer.appendBuffer(arrayBuffer);
              sourceBuffer.addEventListener("updateend", () => {
                try {
                  if (mediaSource.readyState === "open") {
                    mediaSource.endOfStream();
                  }
                } catch {}
              });
            } catch (e) {
              console.error("[audio] MSE error:", e);
              // Fallback to blob URL if MSE fails
              const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
              const fallbackUrl = URL.createObjectURL(blob);
              if (audioRef.current) {
                audioRef.current.src = fallbackUrl;
                audioRef.current.load();
              }
            }
          });
        } else {
          // Fallback for browsers without MSE audio/mpeg support (e.g. Safari)
          const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
          const fallbackUrl = URL.createObjectURL(blob);
          audioRef.current.src = fallbackUrl;
          audioRef.current.load();
        }

        // Setting src resets playbackRate to 1x; restore the chosen speed.
        // onCanPlay reapplies it too, in case the element reloads later.
        audioRef.current.playbackRate = speedRef.current;
        loadedParamsRef.current = paramsKey;
        setLoadedParams(paramsKey);
      }
    } catch {
      setError("Network error — check your connection and try again");
      setLoading(false);
    }
  }, [paramsKey, audioReady, audioUrl]);

  // ── Audio events ───────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastUpdate = 0;

    const onCanPlay = () => {
      setLoading(false);
      setAudioReady(true);
      // Use browser-reported duration if valid
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        knownDurationRef.current = audio.duration;
        setDuration(audio.duration);
      }
      // Reapply the reader's chosen speed: a fresh src resets playbackRate to
      // 1x, but the speed state (and the Nx pill) is unchanged.
      audio.playbackRate = speedRef.current;
      if (!autoPlayedRef.current) {
        autoPlayedRef.current = true;
        audio.play().catch(() => {});
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    const onTimeUpdate = () => {
      const now = performance.now();
      if (now - lastUpdate < 250) return;
      lastUpdate = now;
      const t = audio.currentTime;
      setCurrentTime(t);
      // Track max time reached — this becomes our reliable duration
      if (t > knownDurationRef.current) {
        knownDurationRef.current = t;
        setDuration(t);
      }
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        knownDurationRef.current = audio.duration;
        setDuration(audio.duration);
      }
    };

    const onEnded = () => setPlaying(false);

    const onError = () => {
      if (!audio.src || audio.src === window.location.href) return;
      setLoading(false);
      setError("Audio playback failed — try again");
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [open]);

  // ── Seeking ────────────────────────────────────────────────────────
  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : knownDurationRef.current;
    if (max <= 0) return;
    const clamped = Math.max(0, Math.min(time, max));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [audioReady]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }, [playing, audioReady]);

  const cycleSpeed = useCallback(() => {
    userAdjustedSpeedRef.current = true;
    const idx = TTS_SPEED_OPTIONS.indexOf(speed as typeof TTS_SPEED_OPTIONS[number]);
    const next = TTS_SPEED_OPTIONS[(idx + 1) % TTS_SPEED_OPTIONS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    onSpeedChange?.(next);
  }, [speed, onSpeedChange]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * duration);
    },
    [duration, seekTo],
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
    setMinimized(false);
    loadAudio();
  }, [loadAudio]);

  const handleClose = useCallback(() => {
    audioRef.current?.pause();
    setOpen(false);
    setMinimized(false);
    setPlaying(false);
  }, []);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useKeyboardShortcut("l", () => {
    if (!open) handleOpen();
    else if (audioReady) togglePlay();
  }, { ignoreWhenTyping: true });

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  // ── Collapsed ──────────────────────────────────────────────────────
  // Round icon-only trigger that visually matches the AskBookDrawer chat
  // button, so the two floating controls feel like a coherent set.
  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        title="Listen to this chapter"
        aria-label="Listen to this chapter"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) shadow-lg transition hover:brightness-110"
      >
        <Headphones className="h-5 w-5" />
      </button>
    );
  }

  // ── Minimized bar ──────────────────────────────────────────────────
  if (minimized) {
    return (
      <>
        <audio ref={audioRef} preload="auto" />
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--cr-glass-border) bg-(--cr-bg-root)/95 backdrop-blur-lg pl-4 pr-[4.5rem] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.12)] sm:pr-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button type="button" onClick={togglePlay} className="cf-pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) transition hover:brightness-110" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-cf-label-sm font-medium text-(--cr-text-primary)">{chapterTitle}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {/* Padded transparent wrapper enlarges the touch target to
                 * ~44px tall; the seek math reads this element's width (flex-1,
                 * unchanged by the vertical padding), so positioning holds. */}
                <div className="flex flex-1 cursor-pointer items-center py-[20px] -my-[20px]" onClick={handleProgressClick} ref={progressBarRef}>
                  <div className="relative h-1 w-full rounded-full bg-(--cr-bg-surface-1)">
                    <div className="h-1 rounded-full bg-(--cr-accent) transition-none" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-(--cr-text-disabled)">{fmt(currentTime)} / {fmt(duration)}</span>
              </div>
            </div>
            <button type="button" onClick={cycleSpeed} className="shrink-0 rounded-md border border-(--cr-glass-border) px-2 py-1 text-[10px] font-bold tabular-nums text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-2)">{speed}x</button>
            <button type="button" onClick={() => setMinimized(false)} className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-md p-1.5 text-(--cr-text-disabled) hover:text-(--cr-text-primary)" aria-label="Expand"><Maximize2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={handleClose} className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-md p-1.5 text-(--cr-text-disabled) hover:text-(--cr-text-primary)" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </>
    );
  }

  // ── Expanded ───────────────────────────────────────────────────────
  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="cr-glass-card overflow-hidden border-(--cr-accent)/25 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {playing ? <Volume2 className="h-3.5 w-3.5 text-(--cr-accent) animate-pulse" /> : <Headphones className="h-3.5 w-3.5 text-(--cr-accent)" />}
            <span className="text-cf-caption font-bold uppercase tracking-[0.12em] text-(--cr-accent)">
              {loading ? "Generating audio..." : playing ? "Now Playing" : audioReady ? "Ready" : "Audio"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {audioReady && <button type="button" onClick={() => setMinimized(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md p-1 text-(--cr-text-disabled) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary)" aria-label="Minimize" title="Minimize"><Minimize2 className="h-3.5 w-3.5" /></button>}
            <button type="button" onClick={handleClose} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md p-1 text-(--cr-text-disabled) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary)" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="px-4 pb-1">
          <p className="truncate text-cf-label font-medium text-(--cr-text-primary)">{chapterTitle}</p>
          {!audioMatchesCurrent && !loading && (
            <button type="button" onClick={() => { loadedParamsRef.current = ""; setLoadedParams(""); loadAudio(); }} className="mt-1 text-cf-caption text-(--cr-warning) hover:underline">Reading settings changed — tap to reload audio</button>
          )}
        </div>

        {error && (
          <div className="px-4 py-2">
            <p className="text-cf-label-sm text-(--cr-danger)">{error}</p>
            <button type="button" onClick={() => { loadedParamsRef.current = ""; setLoadedParams(""); loadAudio(); }} className="mt-1 text-cf-label-sm font-semibold text-(--cr-accent) hover:underline">Try Again</button>
          </div>
        )}

        {!error && (
          <div className="px-4 pt-2 pb-1">
            {/* Padded transparent wrapper gives the seek control a ~44px-tall
             * touch target while the visual track stays thin. The seek math
             * reads this element's width (unchanged by the vertical padding),
             * so drag/click positioning is preserved. */}
            <div ref={progressBarRef} className="group relative flex w-full cursor-pointer items-center py-[18px] -my-[18px]" onClick={handleProgressClick} role="slider" aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-label="Audio progress" tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") seekTo(currentTime + 10); if (e.key === "ArrowLeft") seekTo(currentTime - 10); if (e.key === " ") { e.preventDefault(); togglePlay(); } }}>
              <div className="relative h-2 w-full rounded-full bg-(--cr-bg-surface-1)">
                <div className="absolute inset-y-0 left-0 rounded-full bg-(--cr-accent) transition-none" style={{ width: `${progress}%` }} />
                {/* Thumb: hover-reveal on fine pointers, always visible on touch
                 * (pointer-coarse) so it is tappable without a hover state. */}
                <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-(--cr-accent) bg-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100" style={{ left: `calc(${Math.min(progress, 98)}% - 7px)` }} />
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-(--cr-text-disabled)">
              <span>{fmt(currentTime)}</span>
              <span>{duration > 0 ? fmt(duration) : loading ? "generating..." : "--:--"}</span>
            </div>
          </div>
        )}

        {!error && (
          <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-1">
            <button type="button" onClick={() => seekTo(0)} disabled={loading} className="rounded-lg p-2 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary) disabled:opacity-30" aria-label="Restart" title="Restart"><RotateCcw className="h-4 w-4" /></button>
            <button type="button" onClick={() => seekTo(currentTime - 10)} disabled={loading} className="rounded-lg px-2 py-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary) disabled:opacity-30" aria-label="Back 10s" title="Back 10s"><span className="text-cf-caption font-bold">-10s</span></button>
            <button type="button" onClick={togglePlay} disabled={loading} className="cf-pressable flex h-12 w-12 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_20px_color-mix(in_srgb,var(--cr-accent)_35%,transparent)] transition hover:brightness-110 disabled:opacity-60" aria-label={playing ? "Pause" : "Play"}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button type="button" onClick={() => seekTo(currentTime + 10)} disabled={loading} className="rounded-lg px-2 py-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary) disabled:opacity-30" aria-label="Forward 10s" title="Forward 10s"><span className="text-cf-caption font-bold">+10s</span></button>
            <button type="button" onClick={cycleSpeed} className="rounded-lg border border-(--cr-glass-border) px-2.5 py-1.5 text-cf-caption font-bold tabular-nums text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2)" aria-label={`Speed: ${speed}x`} title="Change speed">{speed}x</button>
          </div>
        )}
      </div>
    </>
  );
}
