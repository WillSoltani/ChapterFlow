// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookStateSk,
  bookUserPk,
  chapterStateSk,
} from "./keys";
import type {
  BookUserBookStateItem,
  BookUserChapterStateItem,
} from "./types";
import {
  parseRecord,
  parseStringArray,
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

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

export async function getUserBookState(
  tableName: string,
  userId: string,
  bookId: string
): Promise<BookUserBookStateItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: bookStateSk(bookId),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
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
  };
}

export async function putUserBookState(
  tableName: string,
  state: BookUserBookStateItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(state.userId),
        SK: bookStateSk(state.bookId),
        entity: "BOOK_USER_BOOK_STATE",
        ...state,
      },
    })
  );
}

export async function listAllUserBookStates(
  tableName: string,
  userId: string
): Promise<BookUserBookStateItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "BOOKSTATE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserBookStateItem | null> = rows
    .map((item) => {
      const bookId = readStr(item.bookId);
      if (!bookId) return null;
      return {
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
      } satisfies BookUserBookStateItem;
    });
  return items.filter((item): item is BookUserBookStateItem => item !== null);
}

export async function getUserChapterState(
  tableName: string,
  userId: string,
  bookId: string,
  chapterNumber: number
): Promise<BookUserChapterStateItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: chapterStateSk(bookId, chapterNumber),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    bookId,
    chapterNumber,
    chapterId: readStr(item.chapterId),
    state: parseRecord(item.state),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserChapterState(
  tableName: string,
  item: BookUserChapterStateItem
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(item.userId),
        SK: chapterStateSk(item.bookId, item.chapterNumber),
        entity: "BOOK_USER_CHAPTER_STATE",
        ...item,
      },
    })
  );
}

export async function listUserChapterStates(
  tableName: string,
  userId: string
): Promise<BookUserChapterStateItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "CHAPTERSTATE#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserChapterStateItem | null> = rows
    .map((item) => {
      const bookId = readStr(item.bookId);
      const chapterNumber = readNum(item.chapterNumber);
      if (!bookId || !chapterNumber) return null;
      return {
        userId,
        bookId,
        chapterNumber,
        chapterId: readStr(item.chapterId),
        state: parseRecord(item.state),
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
      } satisfies BookUserChapterStateItem;
    });
  return items.filter((item): item is BookUserChapterStateItem => item !== null);
}

/**
 * Raw (untyped-mapping) scan of a user's CHAPTERSTATE# rows for the Notebook
 * feed, paginated to completion via `queryAllItems`. Moved verbatim from
 * me/notebook/route.ts's GET handler (WS3-002) — deliberately distinct from
 * `listUserChapterStates` above, which ALSO paginates but maps to the typed
 * `BookUserChapterStateItem` shape (dropping `bookTitle`/`chapterTitle`,
 * which the typed shape doesn't carry but the Notebook route reads directly
 * off the raw item). Reusing `listUserChapterStates` here would drop those
 * fields, which is a behavior change.
 *
 * WS4-009: previously a single unpaginated `QueryCommand`, which silently
 * truncated at the first 1MB page once a user's chapter-state rows grew past
 * it. Now follows `LastEvaluatedKey` like every other full-partition read in
 * this file.
 */
export async function queryChapterStatesForNotebook(
  tableName: string,
  userId: string
): Promise<Record<string, unknown>[]> {
  return queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "CHAPTERSTATE#",
    },
  });
}
