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
import { resolvePinnedManifestChaptersWithFallback } from "@/app/app/api/book/_lib/pinned-manifest-core";
import {
  buildInteractionTouchUpdate,
  clampCursorForward,
  sanitizeLastOpenedAt,
} from "@/app/app/api/book/_lib/progress-write-core";
import { readJsonFromS3 } from "@/app/app/api/book/_lib/storage";
import {
  applyProgressCursorTouch,
  getUserBookState,
  getUserProgress,
  putUserBookState,
} from "@/app/app/api/book/_lib/repo";
import {
  getBookApplicationStates,
  toChapterIdKeyedApplicationStates,
} from "@/app/app/api/book/_lib/commitment-application";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { buildBookStateGetResponse } from "@/app/app/api/book/_lib/book-state-status-core";
import type {
  BookManifest,
  BookUserBookStateItem,
  ChapterApplicationState,
} from "@/app/app/api/book/_lib/types";
import { nowIso } from "@/app/app/api/book/_lib/keys";

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
    //
    // Resolve the chapter list from the version the reader is PINNED to
    // (progress.manifestKey), not the latest published manifest: this map turns
    // progress NUMBERS (completedChapters / currentChapterNumber /
    // unlockedThroughChapterNumber / bestScoreByChapter) into chapterIds, and
    // those numbers are frozen on the pinned version. A catalog advance that
    // reordered/renamed chapters would otherwise mis-map them. Reuses the
    // already-fetched live manifest when the pin matches it (no extra S3 read).
    // The pinned read is a NEW S3 GET, so it must DEGRADE gracefully: a transient S3
    // error falls back to the live manifest already in hand rather than 500-ing the
    // whole essential progress read (the pinned-vs-live id divergence only matters on
    // a rare reorder/rename republish — see resolvePinnedManifestChaptersWithFallback).
    const chapters = await resolvePinnedManifestChaptersWithFallback({
      pinnedBookVersion: progress?.pinnedBookVersion ?? null,
      liveVersion: published.version,
      liveManifest: published.manifest,
      readPinnedManifest: () =>
        readJsonFromS3<BookManifest>(contentBucket, progress!.manifestKey),
      onDegrade: (err) =>
        console.error(
          `[state] pinned-manifest read failed for book ${bookId}; degrading chapter map to the live manifest`,
          err,
        ),
    });
    const chapterIdByNumber = new Map(
      chapters.map((chapter) => [chapter.number, chapter.chapterId])
    );
    const applicationStates: Record<string, ChapterApplicationState> =
      toChapterIdKeyedApplicationStates(appByNumber, chapterIdByNumber);
    const statusPresence = {
      hasBookState: bookState !== null,
      hasProgress: progress !== null,
    };

    if (bookState) {
      return bookOk(buildBookStateGetResponse({
        state: bookState,
        applicationStates,
        ...statusPresence,
      }));
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

    return bookOk(buildBookStateGetResponse({
      state: fallbackState,
      applicationStates,
      ...statusPresence,
    }));
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
    //
    // Resolve the chapter list from the reader's PINNED manifest (see the GET
    // handler) so the number→chapterId mapping matches the frozen version their
    // progress is pinned to, not a later catalog republish. DEGRADES to the live
    // manifest on a transient S3 read error so a blip can't 500 the PATCH.
    const chapters = await resolvePinnedManifestChaptersWithFallback({
      pinnedBookVersion: progress?.pinnedBookVersion ?? null,
      liveVersion: published.version,
      liveManifest: published.manifest,
      readPinnedManifest: () =>
        readJsonFromS3<BookManifest>(contentBucket, progress!.manifestKey),
      onDegrade: (err) =>
        console.error(
          `[state] pinned-manifest read failed for book ${bookId} (PATCH); degrading chapter map to the live manifest`,
          err,
        ),
    });
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
    const unlockConstrainedCurrent = unlockedSet.has(requestedCurrent)
      ? requestedCurrent
      : existing?.currentChapterId && unlockedSet.has(existing.currentChapterId)
        ? existing.currentChapterId
        : firstChapterId;
    // FORWARD-ONLY (finding #9): the canonical BOOK_PROGRESS currentChapterNumber is already
    // forward-only, but the user-VISIBLE cursor is THIS projection's currentChapterId, which
    // the GET returns verbatim. Without clamping, a stale tab carrying an older chapter would
    // drag the reader's visible cursor backward AND diverge the projection (backward) from the
    // canonical row (forward). Keep whichever of (existing, candidate) is the more-advanced
    // chapter number on the pinned manifest, so the projection only ever advances.
    const currentChapterId = clampCursorForward({
      candidate: unlockConstrainedCurrent,
      existing: existing?.currentChapterId,
      numberOf: (chapterId) => chapterNumberById.get(chapterId),
    });

    const requestedLastRead =
      typeof rawState.lastReadChapterId === "string" ? rawState.lastReadChapterId : "";
    const lastReadChapterId = unlockedSet.has(requestedLastRead)
      ? requestedLastRead
      : currentChapterId;

    // `lastOpenedAt` is client-supplied UI metadata, but it feeds the "book started"
    // badge clause (lastOpenedAt !== epoch) and recency / last-read sorting — so it
    // must be validated and clamped (numeric, parseable, never in the future) before
    // it lands in BOTH the BOOK_USER_BOOK_STATE projection (nextState below) and the
    // canonical BOOK_PROGRESS row (the UpdateCommand further down). A garbage or
    // far-future value would otherwise corrupt those surfaces.
    const lastOpenedAt = sanitizeLastOpenedAt(rawState.lastOpenedAt, now);

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
    //
    // Reuse the SHARED buildInteractionTouchUpdate seam (same as upsertUserProgress)
    // so this PATCH gets the SAME two guarantees the interaction touch has:
    //  - currentChapterNumber is FORWARD-ONLY — the previous unconditional write moved
    //    the cursor to wherever the client's body pointed, so a stale tab could drag a
    //    concurrently-advanced cursor backward;
    //  - the activity timestamps ALWAYS land even when the cursor advance loses its race
    //    (decoupled writes), so a lost cursor guard can't drop lastOpenedAt/lastActiveAt.
    if (progress) {
      const currentChapterNumber =
        chapterNumberById.get(currentChapterId) ?? progress.currentChapterNumber;
      const { timestamps, cursor } = buildInteractionTouchUpdate({
        nextCurrentChapterNumber: currentChapterNumber,
        lastOpenedAt,
        lastActiveAt: now,
        updatedAt: now,
      });
      await applyProgressCursorTouch(tableName, user.sub, bookId, timestamps);
      await applyProgressCursorTouch(tableName, user.sub, bookId, cursor);
    }

    return bookOk({ state: nextState });
  });
}
