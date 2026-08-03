// Data-access seam for the GDPR/CCPA "download all your data" export
// (WS3-002). Moved verbatim out of me/export/route.ts.
//
// These readers are DELIBERATELY unbounded (they loop on LastEvaluatedKey
// until the partition is exhausted, no page cap), unlike repo-shared.ts's
// `queryAllItems` (which caps at MAX_QUERY_PAGES=50) — a GDPR Art.15 /
// CCPA right-of-access artifact must not silently truncate a heavy user, and
// account-erasure.ts already paginates without a cap, so a user could
// otherwise be fully ERASED yet only partially EXPORTED. Reusing
// `queryAllItems` here would change behavior (a genuinely huge partition
// would truncate where it previously didn't), so this module keeps its own
// pagination helper instead. This module is intentionally scoped to the
// export route only; a cleaner long-term fix is to paginate the shared
// repo.ts list* helpers themselves so every read path benefits.

import "server-only";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk } from "@/app/app/api/book/_lib/keys";
import type {
  BookUserBadgeAwardItem,
  BookUserBookStateItem,
  BookUserChapterStateItem,
  BookUserProgress,
  BookUserReadingDayItem,
  BookUserSavedBookItem,
} from "@/app/app/api/book/_lib/types";

function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (value instanceof Set)
    return Array.from(value).filter((v): v is string => typeof v === "string");
  return [];
}

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value))
    return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (value instanceof Set)
    return Array.from(value).filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );
  return [];
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parseRecord(value)).filter(
      ([key, entryValue]) => typeof key === "string" && typeof entryValue === "string"
    )
  ) as Record<string, string>;
}

function parseNumberRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(parseRecord(value)).filter(
      ([key, entryValue]) =>
        typeof key === "string" &&
        typeof entryValue === "number" &&
        Number.isFinite(entryValue)
    )
  ) as Record<string, number>;
}

/**
 * Query EVERY item under (PK = bookUserPk(userId), begins_with(SK, prefix)),
 * paginating until LastEvaluatedKey is exhausted.
 */
async function queryAllUserItems(
  tableName: string,
  userId: string,
  skPrefix: string,
  scanIndexForward: boolean
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddbDoc.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": bookUserPk(userId),
          ":prefix": skPrefix,
        },
        ScanIndexForward: scanIndexForward,
        ExclusiveStartKey,
      })
    );
    for (const item of res.Items ?? []) items.push(item);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export async function exportAllReadingDays(
  tableName: string,
  userId: string
): Promise<BookUserReadingDayItem[]> {
  const items = await queryAllUserItems(tableName, userId, "READINGDAY#", true);
  const out: BookUserReadingDayItem[] = [];
  for (const item of items) {
    const dayKey = readStr(item.dayKey);
    if (!dayKey) continue;
    out.push({
      userId,
      dayKey,
      totalActiveMs: readNum(item.totalActiveMs) ?? 0,
      updatedAt: readStr(item.updatedAt) || "",
      lastActivityAt: readStr(item.lastActivityAt),
    });
  }
  return out;
}

export async function exportAllProgress(
  tableName: string,
  userId: string
): Promise<BookUserProgress[]> {
  const items = await queryAllUserItems(tableName, userId, "PROGRESS#", false);
  const out: BookUserProgress[] = [];
  for (const item of items) {
    const bookId = readStr(item.bookId);
    if (!bookId) continue;
    out.push({
      userId,
      bookId,
      pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
      contentPrefix: readStr(item.contentPrefix) || "",
      manifestKey: readStr(item.manifestKey) || "",
      currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
      unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
      completedChapters: parseNumberArray(item.completedChapters),
      bestScoreByChapter:
        typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null
          ? (item.bestScoreByChapter as Record<string, number>)
          : {},
      lastOpenedAt: readStr(item.lastOpenedAt),
      lastActiveAt: readStr(item.lastActiveAt),
      streakDays: readNum(item.streakDays),
      preferredVariant: readStr(item.preferredVariant) as BookUserProgress["preferredVariant"],
      updatedAt: readStr(item.updatedAt) || "",
      createdAt: readStr(item.createdAt) || "",
    });
  }
  return out;
}

export async function exportAllBookStates(
  tableName: string,
  userId: string
): Promise<BookUserBookStateItem[]> {
  const items = await queryAllUserItems(tableName, userId, "BOOKSTATE#", true);
  const out: BookUserBookStateItem[] = [];
  for (const item of items) {
    const bookId = readStr(item.bookId);
    if (!bookId) continue;
    out.push({
      userId,
      bookId,
      currentChapterId: readStr(item.currentChapterId) || "",
      completedChapterIds: parseStringArray(item.completedChapterIds),
      unlockedChapterIds: parseStringArray(item.unlockedChapterIds),
      chapterScores: parseNumberRecord(item.chapterScores),
      chapterCompletedAt: parseStringRecord(item.chapterCompletedAt),
      lastReadChapterId: readStr(item.lastReadChapterId) || "",
      lastOpenedAt: readStr(item.lastOpenedAt) || "",
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
    });
  }
  return out;
}

export async function exportAllChapterStates(
  tableName: string,
  userId: string
): Promise<BookUserChapterStateItem[]> {
  const items = await queryAllUserItems(tableName, userId, "CHAPTERSTATE#", true);
  const out: BookUserChapterStateItem[] = [];
  for (const item of items) {
    const bookId = readStr(item.bookId);
    const chapterNumber = readNum(item.chapterNumber);
    if (!bookId || !chapterNumber) continue;
    out.push({
      userId,
      bookId,
      chapterNumber,
      chapterId: readStr(item.chapterId),
      state: parseRecord(item.state),
      createdAt: readStr(item.createdAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
    });
  }
  return out;
}

export async function exportAllSavedBooks(
  tableName: string,
  userId: string
): Promise<BookUserSavedBookItem[]> {
  const items = await queryAllUserItems(tableName, userId, "SAVED#", true);
  const out: BookUserSavedBookItem[] = [];
  for (const item of items) {
    const bookId = readStr(item.bookId);
    if (!bookId) continue;
    out.push({
      userId,
      bookId,
      savedAt: readStr(item.savedAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
      source: readStr(item.source),
      priority: readNum(item.priority),
      pinned: item.pinned === true,
    });
  }
  return out;
}

export async function exportAllBadgeAwards(
  tableName: string,
  userId: string
): Promise<BookUserBadgeAwardItem[]> {
  const items = await queryAllUserItems(tableName, userId, "BADGE#", true);
  const out: BookUserBadgeAwardItem[] = [];
  for (const item of items) {
    const badgeId = readStr(item.badgeId);
    if (!badgeId) continue;
    out.push({
      userId,
      badgeId,
      earnedAt: readStr(item.earnedAt) || "",
      updatedAt: readStr(item.updatedAt) || "",
      tier: readStr(item.tier),
    });
  }
  return out;
}
