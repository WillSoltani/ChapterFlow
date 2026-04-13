import "server-only";

import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, pairSk, pairInvitePk, pairInviteSk, pairNudgeSk, nowIso } from "./keys";
import type { BookUserPairItem, BookPairInviteItem } from "./types";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createPairInvite(
  tableName: string,
  userId: string,
): Promise<BookPairInviteItem> {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 7 * 86400;

  for (let attempt = 0; attempt < 3; attempt++) {
    const inviteCode = generateInviteCode();
    const item: BookPairInviteItem = {
      inviteCode,
      inviterUserId: userId,
      status: "pending",
      expiresAt,
      createdAt: now,
    };

    try {
      await ddbDoc.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: pairInvitePk(inviteCode),
            SK: pairInviteSk(),
            entity: "BOOK_PAIR_INVITE",
            ...item,
            ttl,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      return item;
    } catch (err: unknown) {
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
      if (name === "ConditionalCheckFailedException") continue;
      throw err;
    }
  }

  throw new Error("Failed to generate unique invite code after retries");
}

export async function acceptPairInvite(
  tableName: string,
  inviteCode: string,
  acceptingUserId: string,
): Promise<{ pair: BookUserPairItem; error?: string }> {
  // Get invite
  const inviteResult = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pairInvitePk(inviteCode), SK: pairInviteSk() },
    }),
  );
  const invite = inviteResult.Item as (BookPairInviteItem & { PK: string }) | undefined;

  if (!invite) return { pair: null as never, error: "Invite not found" };
  if (invite.status !== "pending") return { pair: null as never, error: "Invite already used" };
  if (new Date(invite.expiresAt) < new Date()) return { pair: null as never, error: "Invite expired" };
  if (invite.inviterUserId === acceptingUserId) return { pair: null as never, error: "Cannot pair with yourself" };

  // Check if either user already has an active pair
  const existingA = await getUserActivePair(tableName, invite.inviterUserId);
  if (existingA) return { pair: null as never, error: "Inviter already has a partner" };
  const existingB = await getUserActivePair(tableName, acceptingUserId);
  if (existingB) return { pair: null as never, error: "You already have a partner" };

  const now = nowIso();

  // Create bidirectional pair records
  const pairItem: BookUserPairItem = {
    userId: invite.inviterUserId,
    partnerId: acceptingUserId,
    pairedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(invite.inviterUserId),
          SK: pairSk(acceptingUserId),
          entity: "BOOK_USER_PAIR",
          ...pairItem,
        },
      }),
    ),
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: bookUserPk(acceptingUserId),
          SK: pairSk(invite.inviterUserId),
          entity: "BOOK_USER_PAIR",
          userId: acceptingUserId,
          partnerId: invite.inviterUserId,
          pairedAt: now,
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      }),
    ),
    // Mark invite as accepted
    ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...invite,
          PK: pairInvitePk(inviteCode),
          SK: pairInviteSk(),
          status: "accepted",
          acceptedBy: acceptingUserId,
        },
      }),
    ),
  ]);

  return { pair: pairItem };
}

export async function getUserActivePair(
  tableName: string,
  userId: string,
): Promise<BookUserPairItem | null> {
  const result = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "PAIR#",
      },
    }),
  );

  const pairs = (result.Items ?? []) as BookUserPairItem[];
  return pairs.find((p) => p.status === "active") ?? null;
}

export async function deletePair(
  tableName: string,
  userId: string,
  partnerId: string,
): Promise<void> {
  const now = nowIso();
  // Soft-delete both sides
  await Promise.all([
    ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(userId), SK: pairSk(partnerId) },
        UpdateExpression: "SET #s = :ended, endedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":ended": "ended", ":now": now },
      }),
    ),
    ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(partnerId), SK: pairSk(userId) },
        UpdateExpression: "SET #s = :ended, endedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":ended": "ended", ":now": now },
      }),
    ),
  ]);
}

export async function canSendNudge(
  tableName: string,
  userId: string,
  partnerId: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: pairNudgeSk(partnerId, today) },
    }),
  );
  return !result.Item;
}

export async function recordNudgeSent(
  tableName: string,
  userId: string,
  partnerId: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const ttl = Math.floor(Date.now() / 1000) + 2 * 86400;
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: bookUserPk(userId),
        SK: pairNudgeSk(partnerId, today),
        entity: "NUDGE_DEDUP",
        createdAt: nowIso(),
        ttl,
      },
    }),
  );
}
