// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  RETENTION_DAYS_18_MONTHS,
  badgeAwardSk,
  bookMetricsPk,
  bookUserPk,
  dailyMetricsSk,
  engagementSk,
  nowIso,
  readingDaySk,
  shareEventSk,
  ttlEpochSeconds,
} from "./keys";
import type {
  BookUserBadgeAwardItem,
  BookUserEngagementItem,
  BookUserReadingDayItem,
  BookUserShareEventItem,
} from "./types";
import {
  isConditionalCheckFailed,
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

export async function getUserEngagement(
  tableName: string,
  userId: string
): Promise<BookUserEngagementItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: engagementSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    points: Math.max(0, readNum(item.points) ?? 0),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function addUserEngagementPoints(
  tableName: string,
  params: { userId: string; deltaPoints: number }
): Promise<BookUserEngagementItem> {
  const safeDelta = Math.max(0, Math.floor(params.deltaPoints));
  const now = nowIso();
  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: engagementSk(),
      },
      UpdateExpression:
        "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD points :delta",
      ExpressionAttributeValues: {
        ":entity": "BOOK_USER_ENGAGEMENT",
        ":userId": params.userId,
        ":createdAt": now,
        ":updatedAt": now,
        ":delta": safeDelta,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    points: Math.max(0, readNum(item.points) ?? safeDelta),
    createdAt: readStr(item.createdAt) || now,
    updatedAt: readStr(item.updatedAt) || now,
  };
}

export async function addReadingDayActivity(
  tableName: string,
  params: {
    userId: string;
    dayKey: string;
    deltaMs: number;
    occurredAt?: string;
  }
): Promise<BookUserReadingDayItem> {
  const safeDelta = Math.max(0, Math.round(params.deltaMs));
  const now = params.occurredAt || nowIso();
  const res = await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: readingDaySk(params.dayKey),
      },
      UpdateExpression:
        "SET entity = :entity, userId = :userId, dayKey = :dayKey, updatedAt = :updatedAt, lastActivityAt = :lastActivityAt ADD totalActiveMs :delta",
      ExpressionAttributeValues: {
        ":entity": "BOOK_USER_READING_DAY",
        ":userId": params.userId,
        ":dayKey": params.dayKey,
        ":updatedAt": now,
        ":lastActivityAt": now,
        ":delta": safeDelta,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  const item = res.Attributes ?? {};
  return {
    userId: params.userId,
    dayKey: params.dayKey,
    totalActiveMs: readNum(item.totalActiveMs) ?? safeDelta,
    updatedAt: readStr(item.updatedAt) || now,
    lastActivityAt: readStr(item.lastActivityAt) || now,
  };
}

export async function listReadingDays(
  tableName: string,
  userId: string
): Promise<BookUserReadingDayItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "READINGDAY#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserReadingDayItem | null> = rows
    .map((item) => {
      const dayKey = readStr(item.dayKey);
      if (!dayKey) return null;
      return {
        userId,
        dayKey,
        totalActiveMs: readNum(item.totalActiveMs) ?? 0,
        updatedAt: readStr(item.updatedAt) || "",
        lastActivityAt: readStr(item.lastActivityAt),
      } satisfies BookUserReadingDayItem;
    });
  return items.filter((item): item is BookUserReadingDayItem => item !== null);
}

export async function listBadgeAwards(
  tableName: string,
  userId: string
): Promise<BookUserBadgeAwardItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "BADGE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserBadgeAwardItem | null> = rows
    .map((item) => {
      const badgeId = readStr(item.badgeId);
      if (!badgeId) return null;
      return {
        userId,
        badgeId,
        earnedAt: readStr(item.earnedAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
        tier: readStr(item.tier),
      } satisfies BookUserBadgeAwardItem;
    });
  return items.filter((item): item is BookUserBadgeAwardItem => item !== null);
}

export async function putBadgeAward(
  tableName: string,
  params: {
    userId: string;
    badgeId: string;
    earnedAt: string;
    tier?: string;
  }
): Promise<boolean> {
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(params.userId),
          SK: badgeAwardSk(params.badgeId),
          entity: "BOOK_USER_BADGE_AWARD",
          userId: params.userId,
          badgeId: params.badgeId,
          earnedAt: params.earnedAt,
          updatedAt: nowIso(),
          tier: params.tier,
        },
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

/**
 * Increment the per-book, per-day reader metrics (unique readers + loop
 * completions) surfaced on the Progress page's per-title KPIs. Extracted verbatim
 * from the quiz-submit route (WS3-003) — the raw BOOKMETRICS#<bookId> /
 * BOOK_CHAPTER_DAILY_METRICS update is unchanged. Read back by
 * books/[bookId]/metrics/route.ts. Callers fire this best-effort (a metrics
 * write must never fail a loop), so they swallow rejections.
 */
export async function incrementDailyReaderMetrics(
  tableName: string,
  params: { bookId: string; dayKey: string; ts: string }
): Promise<void> {
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: bookMetricsPk(params.bookId), SK: dailyMetricsSk(params.dayKey) },
      UpdateExpression:
        "SET entity = :entity, bookId = :bookId, dayKey = :day, updatedAt = :now ADD uniqueReaders :one, loopCompletions :one",
      ExpressionAttributeValues: {
        ":entity": "BOOK_CHAPTER_DAILY_METRICS",
        ":bookId": params.bookId,
        ":day": params.dayKey,
        ":now": params.ts,
        ":one": 1,
      },
    })
  );
}

/**
 * Query the daily reader/loop KPI rows for one book across a SK range
 * (inclusive). Moved verbatim from books/[bookId]/metrics/route.ts
 * (WS3-002) — the per-item aggregation (today vs week totals) stays in the
 * route, unchanged.
 */
export async function queryDailyReaderMetricsRange(
  tableName: string,
  bookId: string,
  startDayKey: string,
  endDayKey: string
): Promise<Record<string, unknown>[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": bookMetricsPk(bookId),
        ":start": dailyMetricsSk(startDayKey),
        ":end": dailyMetricsSk(endDayKey),
      },
    })
  );
  return res.Items ?? [];
}

export async function putShareEvent(
  tableName: string,
  userId: string,
  event: BookUserShareEventItem,
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: shareEventSk(event.createdAt, event.shareId),
        entity: "BOOK_USER_SHARE_EVENT",
        ...event,
        // Data retention (#16): share events are high-volume engagement telemetry
        // with no compliance value — stamp a DynamoDB TTL (epoch SECONDS) so they
        // age out after ~18 months. Written to the main app table (its `ttl`
        // attribute is enabled). Placed AFTER the spread so a future `event` field
        // can never clobber it. See retentionPolicyFor + docs/DATA-RETENTION.md.
        ttl: ttlEpochSeconds(RETENTION_DAYS_18_MONTHS),
      },
    }),
  );
}
