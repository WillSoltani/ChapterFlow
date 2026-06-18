import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  analyticsTrackReaderFunnel,
  type ReaderFunnelEvent,
} from "@/app/app/api/book/_lib/analytics-repo";

export const runtime = "nodejs";

// Required reader-funnel events (§7). ALWAYS-ON — written like quiz_attempt, NOT
// gated on the opt-in analytics beacon, so the funnel is unbiased. The client
// `track()` shim is a no-op; this is the landing route for those events.
const ALLOWED_EVENTS: ReadonlySet<ReaderFunnelEvent> = new Set([
  "example_expanded",
  "depth_changed",
  "quiz_full_bank_opened",
  "commitment_reached",
  "next_chapter_started",
  "time_to_first_action",
  "pattern_picked",
]);

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const body = requireBodyObject(await req.json());

    const event = typeof body.event === "string" ? body.event : "";
    if (!ALLOWED_EVENTS.has(event as ReaderFunnelEvent)) {
      return bookErr(req, 400, "invalid_event", "Unknown reader funnel event");
    }

    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    if (!bookId) return bookErr(req, 400, "missing_book_id", "bookId is required");

    // Whitelist the payload to known scalar fields so a client can't write
    // arbitrary attributes into the analytics table.
    const payload: { bookId: string; chapterNumber?: number } & Record<string, unknown> = {
      bookId,
    };
    if (typeof body.chapterNumber === "number" && Number.isFinite(body.chapterNumber)) {
      payload.chapterNumber = body.chapterNumber;
    }
    if (body.depth === "simple" || body.depth === "standard" || body.depth === "deeper") {
      payload.depth = body.depth;
    }
    if (typeof body.fromIndex === "number" && Number.isFinite(body.fromIndex)) {
      payload.fromIndex = body.fromIndex;
    }
    if (typeof body.revealedCount === "number" && Number.isFinite(body.revealedCount)) {
      payload.revealedCount = body.revealedCount;
    }
    if (typeof body.msToFirstAction === "number" && Number.isFinite(body.msToFirstAction)) {
      payload.msToFirstAction = body.msToFirstAction;
    }
    if (typeof body.nextChapterNumber === "number" && Number.isFinite(body.nextChapterNumber)) {
      payload.nextChapterNumber = body.nextChapterNumber;
    }
    if (typeof body.patternId === "string" && body.patternId.length > 0 && body.patternId.length <= 120) {
      payload.patternId = body.patternId;
    }

    // Fire-and-forget so analytics never blocks the response. Absent table = no-op.
    const table = await getBookAnalyticsTableName();
    if (table) {
      analyticsTrackReaderFunnel(table, user.sub, event as ReaderFunnelEvent, payload).catch(
        () => {},
      );
    }

    return bookOk({ recorded: Boolean(table) });
  });
}
