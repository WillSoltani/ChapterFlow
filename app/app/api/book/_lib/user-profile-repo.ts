// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  bookUserPk,
  nowIso,
  profileSk,
} from "./keys";
import type { BookUserProfileItem } from "./types";
import {
  parseRecord,
  readStr,
} from "./repo-shared";

export async function getUserProfileItem(
  tableName: string,
  userId: string
): Promise<BookUserProfileItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: profileSk(),
      },
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
  }
): Promise<BookUserProfileItem> {
  const now = nowIso();
  const createdAt = params.createdAt || now;
  await ddbDoc.send(
    new PutCommand({
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
    })
  );
  return {
    userId: params.userId,
    profile: params.profile,
    createdAt,
    updatedAt: now,
  };
}
