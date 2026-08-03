import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import {
  getUserProgress,
  putUserBookState,
  resetProgressGating,
  resetUserBookLearningState,
} from "@/app/app/api/book/_lib/repo";
import { resolvePinnedManifestChapters } from "@/app/app/api/book/_lib/pinned-manifest-core";
import { isResetFullyCleared } from "@/app/app/api/book/_lib/progress-write-core";
import { readJsonFromS3 } from "@/app/app/api/book/_lib/storage";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type { BookManifest, BookUserBookStateItem } from "@/app/app/api/book/_lib/types";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

// Hard reset of a user's progress for a single book.
//
// The reader's auto-PATCH (useBookProgress) is SERVER-TRUTH only — it re-derives
// the per-chapter gating projection from the canonical BOOK_PROGRESS entitlement
// and never lowers it — so an empty PATCH can NOT clear an unlock/completion. A
// genuine "reset progress" therefore needs this dedicated path, which overwrites
// the canonical entitlement back to its initial state. It is the only
// self-service action that LOWERS access (relock); it can never raise it, so
// trusting the authenticated user to reset their own book carries no paywall or
// economy risk. We never touch the free-book entitlement (unlockedBookIds): the
// book stays "started", only its chapter-level progress is cleared.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);
    const [progress, published] = await Promise.all([
      getUserProgress(tableName, user.sub, bookId),
      getPublishedBookManifest({ tableName, contentBucket, bookId }),
    ]);

    const now = nowIso();
    // Resolve the chapter list from the version the reader is PINNED to (their
    // progress.manifestKey), not the latest published manifest. The reset
    // rebuilds the projection's first/unlocked chapterId from this list, so it
    // must match the version the reader's content+progress are frozen on — a
    // catalog advance that reordered/renamed chapters would otherwise project a
    // wrong chapterId. Falls back to the live manifest for a never-started book.
    const chapters = await resolvePinnedManifestChapters({
      pinnedBookVersion: progress?.pinnedBookVersion ?? null,
      liveVersion: published.version,
      liveManifest: published.manifest,
      readPinnedManifest: () =>
        readJsonFromS3<BookManifest>(contentBucket, progress!.manifestKey),
    });
    const firstChapterId = chapters[0]?.chapterId ?? "";

    // The denormalised BOOK_USER_BOOK_STATE projection at its initial value: only
    // the first chapter unlocked, nothing completed, no scores. Also returned to
    // the client regardless of whether it is persisted below.
    const resetState: BookUserBookStateItem = {
      userId: user.sub,
      bookId,
      currentChapterId: firstChapterId,
      completedChapterIds: [],
      unlockedChapterIds: firstChapterId ? [firstChapterId] : [],
      chapterScores: {},
      chapterCompletedAt: {},
      lastReadChapterId: firstChapterId,
      lastOpenedAt: now,
      createdAt: progress?.createdAt ?? now,
      updatedAt: now,
    };

    // Only a started book (BOOK_PROGRESS row present) has progress to reset. Skip
    // entirely when absent so we never (re)create rows for a never-started — or a
    // just-erased — partition. Both writes are gated together for that reason.
    if (progress) {
      // Reset the canonical gating entitlement with a CONDITIONAL PARTIAL update,
      // mirroring the sibling PATCH route. attribute_exists(SK) prevents
      // re-creating a row that was deleted between our (eventually-consistent)
      // read and this write (e.g. account erasure racing the request); SETting
      // only the gating + activity attributes — rather than a spread+Put of the
      // stale snapshot — preserves the identity/version fields and never clobbers
      // a write another tab committed in the meantime.
      const progressStillExists = await resetProgressGating(tableName, user.sub, bookId, now);

      // Rebuild the projection to match the now-reset entitlement. Only written
      // when the entitlement row still exists, so this can't resurrect a row in an
      // erased partition either.
      if (progressStillExists) {
        await putUserBookState(tableName, resetState);

        // Wipe the per-chapter learning state for this book. The canonical
        // BOOK_PROGRESS gating row above is back to chapter 1, but the submit
        // route reconstructs quiz state as
        // `persistedQuizState ?? buildQuizStateFromAttempts({ attempts })` and
        // short-circuits on `quizState?.passed` BEFORE the only path that
        // re-raises unlockedThroughChapterNumber (buildProgressAfterQuizPass).
        // So clearing the QUIZSTATE# row alone is not enough — the fallback
        // rebuilds passed:true from the surviving QUIZATTEMPT# rows and the
        // reader stays permanently stuck at chapter 1. resetUserBookLearningState
        // deletes all three (quiz-state + loop + the per-chapter quiz-ATTEMPT
        // partitions) so the next submit is a genuine fresh attempt. Idempotent
        // and scoped to this book only.
        //
        // A throttled BatchWrite can leave items UNPROCESSED after the bounded
        // retry budget. If ANY QUIZSTATE# / QUIZATTEMPT# row survives, the submit
        // fallback can reconstruct passed:true and silently re-lock the reader at
        // chapter 1 (the A5 brick) — while we'd otherwise report a clean 200. So we
        // surface a RETRYABLE failure instead of a false success: the reset is
        // idempotent, so the client safely retries and the next pass clears the
        // leftovers. The canonical gating row is already reset above, so re-running
        // only re-deletes the stragglers.
        const sweep = await resetUserBookLearningState(
          tableName,
          user.sub,
          bookId
        );
        if (!isResetFullyCleared(sweep)) {
          throw new BookApiError(
            503,
            "reset_incomplete",
            "Resetting your progress hit heavy load and didn't fully clear. Please try again."
          );
        }
      }
    }

    return bookOk({ state: resetState });
  });
}
