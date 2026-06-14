import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import { getUserProgress, putUserBookState } from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type { BookUserBookStateItem } from "@/app/app/api/book/_lib/types";
import { bookUserPk, nowIso, progressSk } from "@/app/app/api/book/_lib/keys";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

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
    const chapters = published.manifest.chapters;
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
      let progressStillExists = true;
      try {
        await ddbDoc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(user.sub), SK: progressSk(bookId) },
            ConditionExpression: "attribute_exists(SK)",
            UpdateExpression:
              "SET currentChapterNumber = :one, unlockedThroughChapterNumber = :one, completedChapters = :empty, bestScoreByChapter = :emptyMap, lastOpenedAt = :now, lastActiveAt = :now, updatedAt = :now",
            ExpressionAttributeValues: {
              ":one": 1,
              ":empty": [] as number[],
              ":emptyMap": {} as Record<string, number>,
              ":now": now,
            },
          })
        );
      } catch (error: unknown) {
        const name =
          error && typeof error === "object"
            ? (error as Record<string, unknown>).name ??
              (error as Record<string, unknown>).__type
            : undefined;
        if (name === "ConditionalCheckFailedException") {
          // The entitlement row vanished between read and write — do not resurrect
          // it, and skip the projection write so we leave the partition untouched.
          progressStillExists = false;
        } else {
          throw error;
        }
      }

      // Rebuild the projection to match the now-reset entitlement. Only written
      // when the entitlement row still exists, so this can't resurrect a row in an
      // erased partition either.
      if (progressStillExists) {
        await putUserBookState(tableName, resetState);
      }
    }

    return bookOk({ state: resetState });
  });
}
