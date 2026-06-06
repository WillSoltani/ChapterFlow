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
  upsertUserProgress,
} from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type { BookUserBookStateItem } from "@/app/app/api/book/_lib/types";
import { nowIso } from "@/app/app/api/book/_lib/keys";

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, score]) =>
        typeof key === "string" &&
        typeof score === "number" &&
        Number.isFinite(score)
    )
  );
}

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
    const [bookState, progress, published] = await Promise.all([
      getUserBookState(tableName, user.sub, bookId),
      getUserProgress(tableName, user.sub, bookId),
      getPublishedBookManifest({ tableName, contentBucket, bookId }),
    ]);

    if (bookState) {
      return bookOk({ state: bookState });
    }

    const chapters = published.manifest.chapters;
    const firstChapterId = chapters[0]?.chapterId ?? "";
    const chapterIdByNumber = new Map(
      chapters.map((chapter) => [chapter.number, chapter.chapterId])
    );
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

    return bookOk({ state: fallbackState });
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

    // Merge incoming state with existing server state using union semantics
    // so concurrent writes don't lose completed/unlocked chapters.
    const incomingCompleted = parseStringArray(rawState.completedChapterIds);
    const incomingUnlocked = parseStringArray(rawState.unlockedChapterIds);
    const incomingScores = parseNumberRecord(rawState.chapterScores);
    const incomingCompletedAt = parseStringRecord(rawState.chapterCompletedAt);

    const mergedCompleted = [...new Set([
      ...(existing?.completedChapterIds ?? []),
      ...incomingCompleted,
    ])];
    const mergedUnlocked = [...new Set([
      ...(existing?.unlockedChapterIds ?? []),
      ...incomingUnlocked,
      ...mergedCompleted,
    ])];
    const mergedScores: Record<string, number> = { ...(existing?.chapterScores ?? {}) };
    for (const [id, score] of Object.entries(incomingScores)) {
      mergedScores[id] = Math.max(mergedScores[id] ?? 0, score);
    }
    const mergedCompletedAt: Record<string, string> = {
      ...(existing?.chapterCompletedAt ?? {}),
      ...incomingCompletedAt,
    };

    const nextState: BookUserBookStateItem = {
      userId: user.sub,
      bookId,
      currentChapterId:
        typeof rawState.currentChapterId === "string" ? rawState.currentChapterId : "",
      completedChapterIds: mergedCompleted,
      unlockedChapterIds: mergedUnlocked,
      chapterScores: mergedScores,
      chapterCompletedAt: mergedCompletedAt,
      lastReadChapterId:
        typeof rawState.lastReadChapterId === "string" ? rawState.lastReadChapterId : "",
      lastOpenedAt:
        typeof rawState.lastOpenedAt === "string" ? rawState.lastOpenedAt : now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await putUserBookState(tableName, nextState);

    if (progress) {
      const chapterNumberById = new Map(
        published.manifest.chapters.map((chapter) => [chapter.chapterId, chapter.number])
      );
      const completedNumbers = nextState.completedChapterIds
        .map((chapterId) => chapterNumberById.get(chapterId) ?? 0)
        .filter((value) => value > 0)
        .sort((left, right) => left - right);
      const unlockedNumbers = nextState.unlockedChapterIds
        .map((chapterId) => chapterNumberById.get(chapterId) ?? 0)
        .filter((value) => value > 0);
      const currentChapterNumber =
        chapterNumberById.get(nextState.currentChapterId) ??
        progress.currentChapterNumber;
      const bestScoreByChapter = Object.fromEntries(
        Object.entries(nextState.chapterScores)
          .map(([chapterId, score]) => {
            const chapterNumber = chapterNumberById.get(chapterId);
            return chapterNumber ? [String(chapterNumber), score] : null;
          })
          .filter((entry): entry is [string, number] => Boolean(entry))
      );

      await upsertUserProgress(tableName, {
        ...progress,
        currentChapterNumber,
        unlockedThroughChapterNumber:
          unlockedNumbers.length > 0
            ? Math.max(...unlockedNumbers)
            : progress.unlockedThroughChapterNumber,
        completedChapters:
          completedNumbers.length > 0 ? completedNumbers : progress.completedChapters,
        bestScoreByChapter: {
          ...progress.bestScoreByChapter,
          ...bestScoreByChapter,
        },
        lastOpenedAt: nextState.lastOpenedAt,
        lastActiveAt: now,
        updatedAt: now,
      });
    }

    return bookOk({ state: nextState });
  });
}
