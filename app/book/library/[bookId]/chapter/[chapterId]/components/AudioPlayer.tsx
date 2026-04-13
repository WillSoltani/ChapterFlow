"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
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
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({
  bookId,
  chapterNumber,
  chapterTitle,
  tone,
  variant,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const autoPlayedRef = useRef(false);
  const loadedParamsRef = useRef("");

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  const paramsKey = `${bookId}:${chapterNumber}:${tone}:${variant}`;
  const audioMatchesCurrent = !audioReady || loadedParamsRef.current === paramsKey;

  const audioUrl = `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audio?tone=${encodeURIComponent(tone)}&variant=${encodeURIComponent(variant)}`;

  // ── Load audio: fetch API (which redirects to S3), then set src to S3 URL ──
  // S3 supports HTTP range requests, enabling native seeking.
  const loadAudio = useCallback(async () => {
    if (loadedParamsRef.current === paramsKey && audioReady) return;

    setLoading(true);
    setError(null);
    setAudioReady(false);
    setCurrentTime(0);
    setDuration(0);
    autoPlayedRef.current = false;

    try {
      // Fetch with redirect: "manual" to capture the S3 signed URL
      const res = await fetch(audioUrl, { redirect: "manual" });

      if (res.status === 302) {
        const s3Url = res.headers.get("Location");
        if (s3Url && audioRef.current) {
          audioRef.current.src = s3Url;
          audioRef.current.load();
          loadedParamsRef.current = paramsKey;
          return;
        }
      }

      // Fallback: if not a redirect, try following it normally
      if (res.status === 200) {
        // Direct response — use blob URL as fallback
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
          loadedParamsRef.current = paramsKey;
        }
        return;
      }

      let msg = "Failed to generate audio";
      try {
        const body = await res.json();
        msg = (body as { error?: { message?: string } })?.error?.message ?? msg;
      } catch {}
      setError(msg);
      setLoading(false);
    } catch {
      setError("Network error — check your connection and try again");
      setLoading(false);
    }
  }, [paramsKey, audioReady, audioUrl]);

  // ── Audio event listeners ──────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let lastUpdate = 0;

    const onCanPlay = () => {
      setLoading(false);
      setAudioReady(true);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
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
      setCurrentTime(audio.currentTime);
    };
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
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

  // ── Controls ───────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }, [playing, audioReady]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : duration;
    if (max <= 0) return;
    const clamped = Math.max(0, Math.min(time, max));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [audioReady, duration]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(speed as typeof SPEED_OPTIONS[number]);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

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
    const audio = audioRef.current;
    audio?.pause();
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

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="inline-flex items-center gap-1.5 rounded-xl border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3.5 py-2 text-[13px] font-semibold text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-accent) hover:border-(--cr-accent)/30" title="Listen to this chapter">
        <Headphones className="h-4 w-4" />
        Listen to Summary
      </button>
    );
  }

  if (minimized) {
    return (
      <>
        <audio ref={audioRef} preload="auto" />
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--cr-glass-border) bg-(--cr-bg-root)/95 backdrop-blur-lg px-4 py-2 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button type="button" onClick={togglePlay} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) transition hover:brightness-110 active:scale-95" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-(--cr-text-primary)">{chapterTitle}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1 flex-1 cursor-pointer rounded-full bg-(--cr-bg-surface-1)" onClick={handleProgressClick} ref={progressBarRef}>
                  <div className="h-1 rounded-full bg-(--cr-accent) transition-none" style={{ width: `${progress}%` }} />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-(--cr-text-disabled)">{fmt(currentTime)} / {fmt(duration)}</span>
              </div>
            </div>
            <button type="button" onClick={cycleSpeed} className="shrink-0 rounded-md border border-(--cr-glass-border) px-2 py-1 text-[10px] font-bold tabular-nums text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-2)">{speed}x</button>
            <button type="button" onClick={() => setMinimized(false)} className="shrink-0 rounded-md p-1.5 text-(--cr-text-disabled) hover:text-(--cr-text-primary)" aria-label="Expand"><Maximize2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={handleClose} className="shrink-0 rounded-md p-1.5 text-(--cr-text-disabled) hover:text-(--cr-text-primary)" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="cr-glass-card overflow-hidden border-(--cr-accent)/25 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {playing ? <Volume2 className="h-3.5 w-3.5 text-(--cr-accent) animate-pulse" /> : <Headphones className="h-3.5 w-3.5 text-(--cr-accent)" />}
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--cr-accent)">
              {loading ? "Generating audio..." : playing ? "Now Playing" : audioReady ? "Ready" : "Audio"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {audioReady && <button type="button" onClick={() => setMinimized(true)} className="rounded-md p-1 text-(--cr-text-disabled) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary)" aria-label="Minimize" title="Minimize"><Minimize2 className="h-3.5 w-3.5" /></button>}
            <button type="button" onClick={handleClose} className="rounded-md p-1 text-(--cr-text-disabled) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary)" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="px-4 pb-1">
          <p className="truncate text-[13px] font-medium text-(--cr-text-primary)">{chapterTitle}</p>
          {!audioMatchesCurrent && !loading && (
            <button type="button" onClick={() => { loadedParamsRef.current = ""; loadAudio(); }} className="mt-1 text-[11px] text-(--cr-warning) hover:underline">Reading settings changed — tap to reload audio</button>
          )}
        </div>

        {error && (
          <div className="px-4 py-2">
            <p className="text-[12px] text-(--cr-danger)">{error}</p>
            <button type="button" onClick={() => { loadedParamsRef.current = ""; loadAudio(); }} className="mt-1 text-[12px] font-semibold text-(--cr-accent) hover:underline">Try Again</button>
          </div>
        )}

        {!error && (
          <div className="px-4 pt-2 pb-1">
            <div ref={progressBarRef} className="group relative h-2 w-full cursor-pointer rounded-full bg-(--cr-bg-surface-1)" onClick={handleProgressClick} role="slider" aria-valuenow={Math.round(currentTime)} aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-label="Audio progress" tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") seekTo(currentTime + 10); if (e.key === "ArrowLeft") seekTo(currentTime - 10); if (e.key === " ") { e.preventDefault(); togglePlay(); } }}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-(--cr-accent) transition-none" style={{ width: `${progress}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-(--cr-accent) bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${Math.min(progress, 98)}% - 7px)` }} />
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
            <button type="button" onClick={() => seekTo(currentTime - 10)} disabled={loading} className="rounded-lg px-2 py-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary) disabled:opacity-30" aria-label="Back 10s" title="Back 10s"><span className="text-[11px] font-bold">-10s</span></button>
            <button type="button" onClick={togglePlay} disabled={loading} className="flex h-12 w-12 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_20px_color-mix(in_srgb,var(--cr-accent)_35%,transparent)] transition hover:brightness-110 active:scale-95 disabled:opacity-60" aria-label={playing ? "Pause" : "Play"}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button type="button" onClick={() => seekTo(currentTime + 10)} disabled={loading} className="rounded-lg px-2 py-1.5 text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-text-primary) disabled:opacity-30" aria-label="Forward 10s" title="Forward 10s"><span className="text-[11px] font-bold">+10s</span></button>
            <button type="button" onClick={cycleSpeed} className="rounded-lg border border-(--cr-glass-border) px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2)" aria-label={`Speed: ${speed}x`} title="Change speed">{speed}x</button>
          </div>
        )}
      </div>
    </>
  );
}
