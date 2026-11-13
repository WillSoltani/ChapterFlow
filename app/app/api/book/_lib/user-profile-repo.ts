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
  profileSk,
} from "./keys";
import type { BookUserProfileItem } from "./types";
import {
  isConditionalCheckFailed,
  parseRecord,
  readStr,
} from "./repo-shared";

export async function getUserProfileItem(
  tableName: string,
  userId: string,
  options?: { consistentRead?: boolean }
): Promise<BookUserProfileItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: profileSk(),
      },
      ...(options?.consistentRead ? { ConsistentRead: true } : {}),
    })
  );
  const item = res.Item;
  if (!item) return null;
  return {
    userId,
    profile: parseRecord(item.profile),
    createdAt: readStr(item.createdAt) || "",
    updatedAt: readStr(item.updatedAt) || "",
  };
}

export async function putUserProfileItem(
  tableName: string,
  params: {
    userId: string;
    profile: Record<string, unknown>;
    createdAt?: string | undefined;
    /**
     * Optimistic-concurrency guard (same rule as putUserSettingsItem): when
     * provided, the write succeeds only if the stored `updatedAt` still equals
     * it, or, for `""`, only if no profile row exists yet.
     */
    expectedUpdatedAt?: string | undefined;
  }
): Promise<BookUserProfileItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;
  const put = new PutCommand({
    TableName: tableName,
    Item: {
      PK: bookUserPk(params.userId),
      SK: profileSk(),
      entity: "BOOK_USER_PROFILE",
      userId: params.userId,
      profile: params.profile,
      createdAt,
      updatedAt: now,
    },
  });
  if (params.expectedUpdatedAt !== undefined) {
    if (params.expectedUpdatedAt === "") {
      put.input.ConditionExpression = "attribute_not_exists(PK)";
    } else {
      put.input.ConditionExpression = "updatedAt = :expected";
      put.input.ExpressionAttributeValues = { ":expected": params.expectedUpdatedAt };
    }
  }
  await ddbDoc.send(put);
  return {
    userId: params.userId,
    profile: params.profile,
    createdAt,
    updatedAt: now,
  };
}

/**
 * Read-modify-write a user's profile under optimistic concurrency, mirroring
 * updateUserSettingsItem. `apply` receives the latest stored profile (`{}`
 * when none exists) and returns the next full profile, or `null` to leave the
 * row untouched. It runs again after a concurrent write, so callers must keep
 * it free of side effects; the last call is the one that was saved.
 */
export async function updateUserProfileItem(
  tableName: string,
  userId: string,
  apply: (current: Record<string, unknown>) => Record<string, unknown>,
  maxAttempts?: number
): Promise<BookUserProfileItem>;
export async function updateUserProfileItem(
  tableName: string,
  userId: string,
  apply: (current: Record<string, unknown>) => Record<string, unknown> | null,
  maxAttempts?: number
): Promise<BookUserProfileItem | null>;
export async function updateUserProfileItem(
  tableName: string,
  userId: string,
  apply: (current: Record<string, unknown>) => Record<string, unknown> | null,
  maxAttempts = 4
): Promise<BookUserProfileItem | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // Read the latest row, so a save right after this reader's own previous
    // save is not mistaken for a conflict.
    const existing = await getUserProfileItem(tableName, userId, { consistentRead: true });
    const nextProfile = apply(existing?.profile ?? {});
    if (nextProfile === null) return existing;
    try {
      return await putUserProfileItem(tableName, {
        userId,
        profile: nextProfile,
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
    "profile_write_conflict",
    "Your profile changed somewhere else at the same time. Please try again."
  );
}
