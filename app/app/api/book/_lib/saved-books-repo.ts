// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  nowIso,
  savedBookSk,
} from "./keys";
import type { BookUserSavedBookItem } from "./types";
import {
  queryAllItems,
  readNum,
  readStr,
} from "./repo-shared";

export async function listSavedBooks(
  tableName: string,
  userId: string
): Promise<BookUserSavedBookItem[]> {
  const rows = await queryAllItems({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk": bookUserPk(userId),
      ":prefix": "SAVED#",
    },
    ScanIndexForward: true,
  });
  const items: Array<BookUserSavedBookItem | null> = rows
    .map((item) => {
      const bookId = readStr(item.bookId);
      if (!bookId) return null;
      return {
        userId,
        bookId,
        savedAt: readStr(item.savedAt) || "",
        updatedAt: readStr(item.updatedAt) || "",
        source: readStr(item.source),
        priority: readNum(item.priority),
        pinned: item.pinned === true,
      } satisfies BookUserSavedBookItem;
    });
  return items.filter((item): item is BookUserSavedBookItem => item !== null);
}

export async function putSavedBook(
  tableName: string,
  params: {
    userId: string;
    bookId: string;
    source?: string | undefined;
    priority?: number | undefined;
    pinned?: boolean | undefined;
  }
): Promise<BookUserSavedBookItem> {
  const existing = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(params.userId),
        SK: savedBookSk(params.bookId),
      },
    })
  );
  const now = nowIso();
  const savedAt = readStr(existing.Item?.savedAt) || now;
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(params.userId),
        SK: savedBookSk(params.bookId),
        entity: "BOOK_SAVED_BOOK",
        userId: params.userId,
        bookId: params.bookId,
        savedAt,
        updatedAt: now,
        source: params.source,
        priority: params.priority,
        pinned: params.pinned === true,
      },
    })
  );
  return {
    userId: params.userId,
    bookId: params.bookId,
    savedAt,
    updatedAt: now,
    source: params.source,
    priority: params.priority,
    pinned: params.pinned === true,
  };
}

export async function deleteSavedBook(
  tableName: string,
  userId: string,
  bookId: string
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: savedBookSk(bookId),
      },
    })
  );
}
