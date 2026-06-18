import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import {
  getBookContentBucket,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getPublishedBookManifest } from "@/app/app/api/book/_lib/content-service";
import {
  getUserBookState,
  getUserProgress,
  putUserBookState,
} from "@/app/app/api/book/_lib/repo";
import {
  getBookApplicationStates,
  toChapterIdKeyedApplicationStates,
} from "@/app/app/api/book/_lib/commitment-application";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type {
  BookUserBookStateItem,
  ChapterApplicationState,
} from "@/app/app/api/book/_lib/types";
import { bookUserPk, nowIso, progressSk } from "@/app/app/api/book/_lib/keys";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, stamp]) => typeof key === "string" && typeof stamp === "string"
    )
  );
}

export const runtime = "nodejs";

export async function GET(
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
    const [bookState, progress, published, appByNumber] = await Promise.all([
      getUserBookState(tableName, user.sub, bookId),
      getUserProgress(tableName, user.sub, bookId),
      getPublishedBookManifest({ tableName, contentBucket, bookId }),
      // The application axis is DERIVED and display-only, so it must NEVER take down
      // the essential progress read: on failure, degrade to {} (the client already
      // tolerates a missing map) and log — do not 500. (Deliberate deviation from the
      // spec's "let it 500": an adversarial review flagged that coupling — a transient
      // commitments-table error failing the whole /state read — as a robustness
      // regression that contradicts the feature's graceful-degradation guardrail.)
      getBookApplicationStates(tableName, user.sub, bookId).catch((err) => {
        console.error(
          `[state] getBookApplicationStates failed for book ${bookId}; degrading applicationStates to {}`,
          err,
        );
        return {} as Record<number, ChapterApplicationState>;
      }),
    ]);

    // Two-axis completion (feedback #4): the application axis is DERIVED and
    // read-only — it gates nothing and awards no IP. Build it once (keyed by
    // chapterId, to match the sibling completedChapterIds / chapterScores fields)
    // and return it on BOTH branches, so it never silently drops for the
    // persisted-state majority. It is intentionally NOT part of the persisted
    // BookUserBookStateItem.
    const chapters = published.manifest.chapters;
    const chapterIdByNumber = new Map(
      chapters.map((chapter) => [chapter.number, chapter.chapterId])
    );
    const applicationStates: Record<string, ChapterApplicationState> =
      toChapterIdKeyedApplicationStates(appByNumber, chapterIdByNumber);

    if (bookState) {
      return bookOk({ state: bookState, applicationStates });
    }

    const firstChapterId = chapters[0]?.chapterId ?? "";
    const completedChapterIds = (progress?.completedChapters ?? [])
      .map((number) => chapterIdByNumber.get(number) ?? "")
      .filter(Boolean);
    const unlockedChapterIds = chapters
      .filter(
        (chapter) => chapter.number <= (progress?.unlockedThroughChapterNumber ?? 1)
      )
      .map((chapter) => chapter.chapterId);
    const currentChapterId =
      chapterIdByNumber.get(progress?.currentChapterNumber ?? 1) ?? firstChapterId;

    const fallbackState: BookUserBookStateItem = {
      userId: user.sub,
      bookId,
      currentChapterId,
      completedChapterIds,
      unlockedChapterIds: unlockedChapterIds.length ? unlockedChapterIds : firstChapterId ? [firstChapterId] : [],
      chapterScores: Object.fromEntries(
        Object.entries(progress?.bestScoreByChapter ?? {}).map(([chapterNumber, score]) => {
          const chapterId = chapterIdByNumber.get(Number(chapterNumber));
          return chapterId ? [chapterId, score] : null;
        }).filter((entry): entry is [string, number] => Boolean(entry))
      ),
      chapterCompletedAt: {},
      lastReadChapterId: currentChapterId,
      lastOpenedAt: progress?.lastOpenedAt ?? new Date(0).toISOString(),
      createdAt: progress?.createdAt ?? nowIso(),
      updatedAt: progress?.updatedAt ?? nowIso(),
    };

    return bookOk({ state: fallbackState, applicationStates });
  });
}

export async function PATCH(
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
    const [existing, progress, published] = await Promise.all([
      getUserBookState(tableName, user.sub, bookId),
      getUserProgress(tableName, user.sub, bookId),
      getPublishedBookManifest({ tableName, contentBucket, bookId }),
    ]);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const rawState =
      body.state && typeof body.state === "object" && !Array.isArray(body.state)
        ? (body.state as Record<string, unknown>)
        : body;

    const now = nowIso();

    // ── Gating state is SERVER-TRUTH only ──────────────────────────────────
    // Which chapters are unlocked/completed (and their best scores) is written
    // EXCLUSIVELY by the quiz-pass path (buildProgressAfterQuizPass via
    // recordQuizAttemptOutcome in the quiz submit route) and the quiz-gated
    // unlock route — both of which require a passed quiz. This PATCH must NEVER
    // raise unlockedThroughChapterNumber, add completedChapters, or invent
    // bestScoreByChapter from the request body: the reader auto-PATCHes its
    // localStorage progress on every change (useBookProgress), so trusting the
    // body would let any user unlock and "complete" every chapter by editing
    // localStorage and bypass the quiz gate entirely. We re-derive the
    // per-chapter projection stored in BOOK_USER_BOOK_STATE from the canonical
    // BOOK_PROGRESS entitlement, exactly like the GET fallback above.
    const chapters = published.manifest.chapters;
    const firstChapterId = chapters[0]?.chapterId ?? "";
    const chapterIdByNumber = new Map(
      chapters.map((chapter) => [chapter.number, chapter.chapterId])
    );
    const chapterNumberById = new Map(
      chapters.map((chapter) => [chapter.chapterId, chapter.number])
    );

    const unlockedThroughChapterNumber = progress?.unlockedThroughChapterNumber ?? 1;
    const unlockedChapterIds = chapters
      .filter((chapter) => chapter.number <= unlockedThroughChapterNumber)
      .map((chapter) => chapter.chapterId);
    const completedChapterIds = (progress?.completedChapters ?? [])
      .map((number) => chapterIdByNumber.get(number) ?? "")
      .filter(Boolean);
    const chapterScores = Object.fromEntries(
      Object.entries(progress?.bestScoreByChapter ?? {})
        .map(([chapterNumber, score]) => {
          const chapterId = chapterIdByNumber.get(Number(chapterNumber));
          return chapterId ? [chapterId, score] : null;
        })
        .filter((entry): entry is [string, number] => Boolean(entry))
    );

    const unlockedSet = new Set(unlockedChapterIds);
    const completedSet = new Set(completedChapterIds);

    // chapterCompletedAt is client UI metadata (when the reader locally marked a
    // chapter done). It gates nothing, so accept it — but only for chapters the
    // server actually considers complete, so it stays consistent with truth.
    const incomingCompletedAt = parseStringRecord(rawState.chapterCompletedAt);
    const chapterCompletedAt = Object.fromEntries(
      Object.entries({
        ...(existing?.chapterCompletedAt ?? {}),
        ...incomingCompletedAt,
      }).filter(([chapterId]) => completedSet.has(chapterId))
    );

    // ── Non-gating UI navigation fields: accepted from the client ──────────
    // currentChapterId / lastReadChapterId / lastOpenedAt only move the reader's
    // cursor; they never grant access. Constrain the cursor to unlocked chapters
    // so it can't point at locked content (which would 403 on read anyway).
    const requestedCurrent =
      typeof rawState.currentChapterId === "string" ? rawState.currentChapterId : "";
    const currentChapterId = unlockedSet.has(requestedCurrent)
      ? requestedCurrent
      : existing?.currentChapterId && unlockedSet.has(existing.currentChapterId)
        ? existing.currentChapterId
        : firstChapterId;

    const requestedLastRead =
      typeof rawState.lastReadChapterId === "string" ? rawState.lastReadChapterId : "";
    const lastReadChapterId = unlockedSet.has(requestedLastRead)
      ? requestedLastRead
      : currentChapterId;

    const lastOpenedAt =
      typeof rawState.lastOpenedAt === "string" ? rawState.lastOpenedAt : now;

    const nextState: BookUserBookStateItem = {
      userId: user.sub,
      bookId,
      currentChapterId,
      completedChapterIds,
      unlockedChapterIds,
      chapterScores,
      chapterCompletedAt,
      lastReadChapterId,
      lastOpenedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await putUserBookState(tableName, nextState);

    // Sync only the non-gating progress pointers (cursor + activity timestamps).
    // This MUST be a non-destructive partial update, not a full-item Put built
    // from the read above: getUserProgress is an eventually-consistent read, so
    // a spread+Put could overwrite (roll back) an unlock that the quiz-pass
    // transaction committed moments earlier. By SETting only these attributes we
    // leave the gating fields (unlockedThroughChapterNumber / completedChapters /
    // bestScoreByChapter) exactly as the quiz-pass and quiz-gated unlock paths
    // wrote them.
    if (progress) {
      const currentChapterNumber =
        chapterNumberById.get(currentChapterId) ?? progress.currentChapterNumber;
      try {
        await ddbDoc.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: bookUserPk(user.sub), SK: progressSk(bookId) },
            ConditionExpression: "attribute_exists(SK)",
            UpdateExpression:
              "SET currentChapterNumber = :currentChapterNumber, lastOpenedAt = :lastOpenedAt, lastActiveAt = :lastActiveAt, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":currentChapterNumber": currentChapterNumber,
              ":lastOpenedAt": lastOpenedAt,
              ":lastActiveAt": now,
              ":updatedAt": now,
            },
          })
        );
      } catch (error: unknown) {
        // Progress row vanished between read and write (e.g. account erasure) —
        // there is nothing to sync, and we must never (re)create a partial
        // BOOK_PROGRESS item. Any other error is real and re-thrown.
        const name =
          error && typeof error === "object"
            ? (error as Record<string, unknown>).name ??
              (error as Record<string, unknown>).__type
            : undefined;
        if (name !== "ConditionalCheckFailedException") {
          throw error;
        }
      }
    }

    return bookOk({ state: nextState });
  });
}
