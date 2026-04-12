"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, X } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type AudioPlayerProps = {
  bookId: string;
  chapterNumber: number;
  tone: string;
  variant: string;
  isPro: boolean;
};

type AudioResponse = { audioUrl: string; cached: boolean };

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export function AudioPlayer({
  bookId,
  chapterNumber,
  tone,
  variant,
  isPro,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadAudio = useCallback(async () => {
    if (!isPro) {
      setError("Audio mode requires a Pro subscription");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBookJson<AudioResponse>(
        `/app/api/book/books/${encodeURIComponent(bookId)}/chapters/${chapterNumber}/audio?tone=${tone}&variant=${variant}`,
      );
      if (audioRef.current) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.load();
      }
    } catch {
      setError("Failed to load audio");
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterNumber, tone, variant, isPro]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    const currentIndex = SPEED_OPTIONS.indexOf(speed as typeof SPEED_OPTIONS[number]);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newSpeed = SPEED_OPTIONS[nextIndex];
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  }, [speed]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (!audioRef.current?.src) {
      loadAudio();
    }
  }, [loadAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Trigger button (when closed)
  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-(--cr-glass-border) bg-(--cr-bg-surface-3) px-3 py-1.5 text-xs font-semibold text-(--cr-text-secondary) transition hover:bg-(--cr-bg-surface-2) hover:text-(--cr-accent)"
        title="Listen to chapter summary"
      >
        <Headphones className="h-3.5 w-3.5" />
        Listen
      </button>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <div className="cr-glass-card flex items-center gap-3 border-(--cr-accent)/20 px-4 py-3">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={loading || !!error}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--cr-accent) text-(--cr-text-inverse) transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>

        {/* Progress */}
        <div className="flex-1">
          {error ? (
            <p className="text-xs text-(--cr-danger)">{error}</p>
          ) : (
            <>
              <div
                className="h-1.5 cursor-pointer rounded-full bg-(--cr-bg-surface-1)"
                onClick={(e) => {
                  if (!audioRef.current || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  audioRef.current.currentTime = pct * duration;
                }}
              >
                <div
                  className="h-1.5 rounded-full bg-(--cr-accent) transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-(--cr-text-disabled)">
                <span>{formatTime(currentTime)}</span>
                <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
              </div>
            </>
          )}
        </div>

        {/* Speed */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="rounded-md border border-(--cr-glass-border) px-2 py-0.5 text-[10px] font-bold text-(--cr-text-secondary) hover:bg-(--cr-bg-surface-2)"
        >
          {speed}x
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => {
            audioRef.current?.pause();
            setOpen(false);
          }}
          className="text-(--cr-text-disabled) hover:text-(--cr-text-primary)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
