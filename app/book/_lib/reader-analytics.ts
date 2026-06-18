import { fetchBookJson } from "@/app/book/_lib/book-api";

// Reader behavior-loop funnel events (§7). These land server-side via the
// always-on /me/analytics/track route — NOT through the no-op client `track()`
// shim and NOT through the opt-in analytics beacon, so the funnel is unbiased.
export type ReaderFunnelEvent =
  | "example_expanded"
  | "depth_changed"
  | "quiz_full_bank_opened"
  | "commitment_reached"
  | "next_chapter_started"
  | "time_to_first_action"
  | "pattern_picked";

/**
 * Fire-and-forget a reader-funnel event. Never blocks or throws into the UI; an
 * analytics failure is silently swallowed (the event is best-effort telemetry).
 */
export function trackReaderFunnel(
  event: ReaderFunnelEvent,
  payload: { bookId: string; chapterNumber?: number } & Record<string, unknown>,
): void {
  void fetchBookJson("/app/api/book/me/analytics/track", {
    method: "POST",
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => {});
}
