// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "./errors";
import {
  bookUserPk,
  nowIso,
  settingsSk,
} from "./keys";
import type { BookUserSettingsItem } from "./types";
import {
  isConditionalCheckFailed,
  parseRecord,
  readStr,
} from "./repo-shared";

export async function getUserSettingsItem(
  tableName: string,
  userId: string
): Promise<BookUserSettingsItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: settingsSk(),
      },
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    settings: parseRecord(item.settings),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserSettingsItem(
  tableName: string,
  params: {
    userId: string;
    settings: Record<string, unknown>;
    createdAt?: string;
    /**
     * Optimistic-concurrency guard. When provided, the write only succeeds if
     * the stored `updatedAt` still equals this value (or the item is absent for
     * `""`). On mismatch a ConditionalCheckFailedException is thrown so callers
     * can re-read and retry instead of silently clobbering a concurrent write.
     */
    expectedUpdatedAt?: string;
  }
): Promise<BookUserSettingsItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;

  const put = new PutCommand({
    TableName: tableName,
    Item: {
      PK: bookUserPk(params.userId),
      SK: settingsSk(),
      entity: "BOOK_USER_SETTINGS",
      userId: params.userId,
      settings: params.settings,
      createdAt,
      updatedAt: now,
    },
  });

  if (params.expectedUpdatedAt !== undefined) {
    if (params.expectedUpdatedAt === "") {
      // First write for this user: succeed only if no settings item exists yet.
      put.input.ConditionExpression = "attribute_not_exists(PK)";
    } else {
      // Subsequent write: succeed only if nobody else has written since we read.
      put.input.ConditionExpression = "updatedAt = :expected";
      put.input.ExpressionAttributeValues = { ":expected": params.expectedUpdatedAt };
    }
  }

  await ddbDoc.send(put);
  return {
    userId: params.userId,
    settings: params.settings,
    createdAt,
    updatedAt: now,
  };
}

/**
 * Read-modify-write a user's settings under optimistic concurrency. `apply`
 * receives the latest persisted settings (`{}` when none exist) and returns the
 * next full settings object. The conditional Put is retried on a concurrent
 * write so near-simultaneous updates (e.g. an in-app settings save racing a
 * one-click email unsubscribe) cannot silently overwrite each other.
 */
export async function updateUserSettingsItem(
  tableName: string,
  userId: string,
  apply: (current: Record<string, unknown>) => Record<string, unknown>,
  maxAttempts = 4
): Promise<BookUserSettingsItem> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existing = await getUserSettingsItem(tableName, userId);
    const nextSettings = apply(existing?.settings ?? {});
    try {
      return await putUserSettingsItem(tableName, {
        userId,
        settings: nextSettings,
        createdAt: existing?.createdAt,
        expectedUpdatedAt: existing?.updatedAt ?? "",
      });
    } catch (error: unknown) {
      if (!isConditionalCheckFailed(error)) throw error;
      // A concurrent writer won the race; loop to re-read and re-apply.
    }
  }
  throw new BookApiError(
    409,
    "settings_write_conflict",
    "Settings were updated concurrently. Please retry."
  );
}
