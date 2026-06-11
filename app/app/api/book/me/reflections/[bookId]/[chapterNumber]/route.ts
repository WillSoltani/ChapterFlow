import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  getBookAnalyticsTableName,
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import {
  applyStartDeviceCookie,
  ensureUserBookStarted,
} from "@/app/app/api/book/_lib/ensure-book-started";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getCachedChapterValidation } from "@/app/app/api/book/_lib/chapter-validation-cache";
import { awardFlowPoints } from "@/app/app/api/book/_lib/flow-points-repo";
import { analyticsTrackFlowPointsTransaction } from "@/app/app/api/book/_lib/analytics-repo";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }
    const chapterNumberInt = Math.floor(chapterNum);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }
    const body = requireBodyObject(bodyRaw);

    const exampleId = typeof body.exampleId === "string" ? body.exampleId.trim() : "";
    const reflectionLengthRaw = body.reflectionLength;

    if (!exampleId) {
      throw new BookApiError(400, "invalid_example_id", "exampleId is required.");
    }
    if (
      typeof reflectionLengthRaw !== "number" ||
      !Number.isFinite(reflectionLengthRaw) ||
      reflectionLengthRaw < 1
    ) {
      throw new BookApiError(400, "empty_reflection", "Reflection cannot be empty.");
    }

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();

    const started = await ensureUserBookStarted({
      req,
      user,
      tableName,
      contentBucket,
      bookId,
      interactionChapterNumber: chapterNumberInt,
    });

    // Chapter-level access check using the progress already loaded by
    // ensureUserBookStarted — saves a redundant DDB read.
    if (chapterNumberInt > started.progress.unlockedThroughChapterNumber) {
      throw new BookApiError(403, "chapter_locked", "This chapter is locked.");
    }

    // Cached lookup: example IDs + book title (10 min TTL, in-process LRU).
    // Skips 3 round-trips on cache hit (catalog, version, chapter S3).
    const { exampleIds, bookTitle } = await getCachedChapterValidation({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber: chapterNumberInt,
    });

    if (!exampleIds.has(exampleId)) {
      throw new BookApiError(400, "invalid_example_id", "exampleId not found in chapter.");
    }

    const result = await awardFlowPoints(tableName, {
      userId: user.sub,
      amount: INSIGHT_POINTS_AMOUNTS.reflectionSubmitted,
      sourceType: "reflection_submitted",
      sourceId: `${bookId}:${chapterNumberInt}:${exampleId}`,
      metadata: {
        bookId,
        chapterNumber: chapterNumberInt,
        exampleId,
        bookTitle,
        chapterLabel: `Chapter ${chapterNumberInt}`,
      },
    });

    // Fire-and-forget analytics — never block the user.
    if (result.awarded) {
      getBookAnalyticsTableName()
        .then((analyticsTable) => {
          if (!analyticsTable) return;
          return analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub,
            deltaPoints: INSIGHT_POINTS_AMOUNTS.reflectionSubmitted,
            direction: "earn",
            sourceType: "reflection_submitted",
            sourceId: `${bookId}:${chapterNumberInt}:${exampleId}`,
            metadata: {
              bookId,
              chapterNumber: chapterNumberInt,
              exampleId,
              bookTitle,
              chapterLabel: `Chapter ${chapterNumberInt}`,
            },
          });
        })
        .catch(() => {});
    }

    const response = bookOk({
      awarded: result.awarded,
      amount: result.awarded ? INSIGHT_POINTS_AMOUNTS.reflectionSubmitted : 0,
      alreadyClaimed: result.reason === "duplicate",
      reason: result.reason,
      balance: result.state.points,
    });
    return applyStartDeviceCookie(response, started);
  });
}
