import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { recordReview } from "@/app/app/api/book/_lib/fsrs-repo";
import { getRetrievability } from "@/app/app/api/book/_lib/fsrs";
import type { FSRSRating } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

const VALID_RATINGS = new Set<FSRSRating>([1, 2, 3, 4]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { cardId } = await params;

    if (!cardId) {
      throw new BookApiError(400, "invalid_card_id", "cardId is required.");
    }

    const body = requireBodyObject(await req.json());
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

    const updated = await recordReview(
      tableName,
      user.sub,
      decodedCardId,
      rating as FSRSRating
    );

    const now = new Date();

    return bookOk({
      card: {
        ...updated,
        retrievability: getRetrievability(updated, now),
      },
    });
  });
}
