import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getFSRSCard, recordReview } from "@/app/app/api/book/_lib/fsrs-repo";
import { getRetrievability } from "@/app/app/api/book/_lib/fsrs";
import type { FSRSRating } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

const VALID_RATINGS = new Set<FSRSRating>([1, 2, 3, 4]);

// Idempotency window: collapse duplicate grades for the same card (double-click,
// client retry, two open tabs) that arrive within this many milliseconds of the
// previous review. FSRS pushes a freshly-reviewed card's next due date at least
// a full day out, so a legitimate second review of the same card seconds later
// never happens — anything inside this window is a duplicate submit. Running
// scheduleCard twice would advance reps/stability again and over-schedule the
// card, plus write a phantom review log, so we no-op and return the card already
// scheduled by the first submit. (A new, never-reviewed card has reps === 0 and
// state "new"; its recent lastReviewAt comes from creation, so it is excluded.)
const REVIEW_DEDUPE_WINDOW_MS = 5_000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { cardId } = await params;

    if (!cardId) {
      throw new BookApiError(400, "invalid_card_id", "cardId is required.");
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const rating = body.rating as number;

    if (!VALID_RATINGS.has(rating as FSRSRating)) {
      throw new BookApiError(
        400,
        "invalid_rating",
        "rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)."
      );
    }

    const tableName = await getBookTableName();
    const decodedCardId = decodeURIComponent(cardId);

    const now = new Date();

    // Read the current card first so we can reject duplicate submits before
    // re-running the (stateful) scheduler. recordReview itself has no
    // optimistic-concurrency guard, so without this a retry/double-click would
    // advance the card a second time and write a duplicate review log.
    const current = await getFSRSCard(tableName, user.sub, decodedCardId);
    if (!current) {
      throw new BookApiError(404, "card_not_found", "FSRS card not found.");
    }

    if (
      current.reps > 0 &&
      now.getTime() - new Date(current.lastReviewAt).getTime() <
        REVIEW_DEDUPE_WINDOW_MS
    ) {
      // Duplicate submit inside the dedupe window — return the already-scheduled
      // card without advancing the scheduler or writing another review log.
      return bookOk({
        card: {
          ...current,
          retrievability: getRetrievability(current, now),
        },
      });
    }

    const updated = await recordReview(
      tableName,
      user.sub,
      decodedCardId,
      rating as FSRSRating
    );

    return bookOk({
      card: {
        ...updated,
        retrievability: getRetrievability(updated, now),
      },
    });
  });
}
