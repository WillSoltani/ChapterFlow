import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import {
  getBookContentBucket,
  getBookTableName,
  getBookAnalyticsTableName,
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
import { analyticsTrackBookCompleted } from "@/app/app/api/book/_lib/analytics-repo";
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
    const user = await requireUser();
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
    const user = await requireUser();
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
    const nextState: BookUserBookStateItem = {
      userId: user.sub,
      bookId,
      currentChapterId:
        typeof rawState.currentChapterId === "string" ? rawState.currentChapterId : "",
      completedChapterIds: parseStringArray(rawState.completedChapterIds),
      unlockedChapterIds: parseStringArray(rawState.unlockedChapterIds),
      chapterScores: parseNumberRecord(rawState.chapterScores),
      chapterCompletedAt: parseStringRecord(rawState.chapterCompletedAt),
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

    // Analytics: detect book completion (all chapters done)
    const totalChapterCount = published.manifest.chapters.length;
    const isBookCompleted =
      totalChapterCount > 0 &&
      nextState.completedChapterIds.length >= totalChapterCount;
    const wasAlreadyCompleted =
      existing !== null &&
      existing.completedChapterIds.length >= totalChapterCount;

    if (isBookCompleted && !wasAlreadyCompleted) {
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        analyticsTrackBookCompleted(analyticsTable, {
          userId: user.sub,
          bookId,
          totalChapterCount,
        }).catch(() => {});
      }).catch(() => {});
    }

    return bookOk({ state: nextState });
  });
}
