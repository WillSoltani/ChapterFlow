/**
 * Daily limit on paid text-to-speech generation for the chapter audio route
 * (pure, unit-tested). Cached segments are free and never count; a request
 * that has to generate any missing clip reserves one unit, once.
 */

/** Audio requests per user per UTC day that may trigger speech generation. */
export const AUDIO_GENERATION_DAILY_LIMIT = 20;

export function audioGenerationLimitSk(dateKey: string): string {
  return `AUDIO_TTS_LIMIT#${dateKey}`;
}

/**
 * Wraps a one-unit reservation so a request reserves at most once, however
 * many segments it generates (in parallel or in sequence). A failed
 * reservation (the 429 from the limiter) rejects every caller.
 */
export function createGenerationReservation(reserve: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () => {
    pending ??= reserve();
    return pending;
  };
}
