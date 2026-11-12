/**
 * Load with retries, never rejecting: the first try, then one more after each
 * of `delays`; after the last failure, wait until the browser reports the
 * network back (`online`) and start over. Used for the landing's gated motion
 * feature import (MotionFeatureProvider): it runs late in the page view (a
 * menu tap, Pricing approaching), when a phone may have lost its connection,
 * and LazyMotion calls its loader once, so one failed chunk fetch would leave
 * every animated element at its initial style for the rest of the visit.
 *
 * Pure apart from the default timers and `online` event (both injectable).
 */

export type RetryOptions = {
  /** Waits between tries (ms). */
  delays?: readonly number[];
  wait?: (ms: number) => Promise<void>;
  /** Resolves when it is worth trying again after the last delay. */
  online?: () => Promise<void>;
  /** Told about each failure (dev logging); never throws back. */
  onError?: (error: unknown, attempt: number) => void;
};

export const MOTION_RETRY_DELAYS: readonly number[] = [500, 1500, 4000];

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function defaultOnline(): Promise<void> {
  if (typeof window === "undefined") return new Promise<void>(() => {});
  return new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
}

export async function loadWithRetry<T>(load: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const delays = opts.delays ?? MOTION_RETRY_DELAYS;
  const wait = opts.wait ?? defaultWait;
  const online = opts.online ?? defaultOnline;
  let attempt = 0;
  for (;;) {
    for (let i = 0; i <= delays.length; i++) {
      if (i > 0) await wait(delays[i - 1]!);
      try {
        return await load();
      } catch (e) {
        attempt++;
        try {
          opts.onError?.(e, attempt);
        } catch {
          // A logger never breaks the load.
        }
      }
    }
    await online();
  }
}
