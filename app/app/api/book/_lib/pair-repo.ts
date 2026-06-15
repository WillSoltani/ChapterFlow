import "server-only";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, pairSk, pairInvitePk, pairInviteSk, pairNudgeSk, streakSk, nowIso } from "./keys";
import { getUserProfileItem, listAllUserProgress } from "./repo";
import type { BookUserPairItem, BookPairInviteItem } from "./types";

function generateInviteCode(): string {
  // CSPRNG-backed (matches the referral-code generator's crypto path). The
  // alphabet is exactly 32 chars (a power of two), so masking each random byte
  // with & 31 maps it onto the alphabet uniformly — no modulo bias.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] & 31];
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

  // Commit all three writes atomically so a losing concurrent accept fails
  // cleanly instead of clobbering. The pair Puts require the records not to
  // already exist (attribute_not_exists) and the invite Put requires it to still
  // be pending; if any condition fails the whole transaction is cancelled and we
  // surface "Invite already used" rather than a half-written/duplicated link.
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: bookUserPk(invite.inviterUserId),
                SK: pairSk(acceptingUserId),
                entity: "BOOK_USER_PAIR",
                ...pairItem,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            Put: {
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
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            // Mark invite as accepted, but only while it is still pending.
            Put: {
              TableName: tableName,
              Item: {
                ...invite,
                PK: pairInvitePk(inviteCode),
                SK: pairInviteSk(),
                status: "accepted",
                acceptedBy: acceptingUserId,
              },
              ConditionExpression: "#status = :pending",
              ExpressionAttributeNames: { "#status": "status" },
              ExpressionAttributeValues: { ":pending": "pending" },
            },
          },
        ],
      }),
    );
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") {
      return { pair: null as never, error: "Invite already used" };
    }
    throw err;
  }

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

/**
 * A PII-safe summary of a reading partner for the accountability UI. Both users
 * opted into this view by pairing, so coarse activity signals are exposed —
 * never the partner's email, user id, or the titles of the books they're reading.
 */
export type PairPartnerSummary = {
  /** The partner's chosen display name only (mirrors the gift-preview pattern); null if they never set one. */
  displayName: string | null;
  currentStreak: number;
  booksInProgress: number;
  /** Coarse last-active day (YYYY-MM-DD) from the streak record; null if the partner has no recorded activity. */
  lastActiveDate: string | null;
};

export type ActivePairResult = {
  pair: BookUserPairItem | null;
  partner: PairPartnerSummary | null;
};

/**
 * Read-only streak snapshot. Unlike getOrCreateStreak, this NEVER writes — it
 * must not create a streak record as a side effect of viewing someone else's data.
 */
async function getPartnerStreakSnapshot(
  tableName: string,
  partnerId: string,
): Promise<{ currentStreak: number; lastActiveDate: string | null }> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(partnerId), SK: streakSk() },
    }),
  );
  const item = res.Item;
  const rawStreak = item?.currentStreak;
  const currentStreak =
    typeof rawStreak === "number" && Number.isFinite(rawStreak) ? Math.max(0, rawStreak) : 0;
  const lastActiveDate = typeof item?.lastActiveDate === "string" ? item.lastActiveDate : null;
  return { currentStreak, lastActiveDate };
}

/**
 * The viewer's active pair plus a PII-safe summary of the partner so the card
 * can show whether the partner is actually active (the point of an accountability
 * partner) rather than just "paired since {date}". Each partner lookup is
 * best-effort: a missing profile/streak/progress degrades that one field to its
 * neutral default instead of failing the whole request.
 */
export async function getActivePairWithPartner(
  tableName: string,
  userId: string,
): Promise<ActivePairResult> {
  const pair = await getUserActivePair(tableName, userId);
  if (!pair) return { pair: null, partner: null };

  const partnerId = pair.partnerId;
  const [displayName, streak, progress] = await Promise.all([
    getUserProfileItem(tableName, partnerId)
      .then((p) => {
        const dn = p?.profile?.displayName;
        return typeof dn === "string" && dn.trim() ? dn.trim() : null;
      })
      .catch(() => null),
    getPartnerStreakSnapshot(tableName, partnerId).catch(() => ({
      currentStreak: 0,
      lastActiveDate: null,
    })),
    listAllUserProgress(tableName, partnerId).catch(() => []),
  ]);

  // "In progress" must mean started-with-real-activity AND not yet completed, to
  // match the app's canonical classifier (useBookAnalytics.statusFromCounts:
  // in_progress only once completed > 0). Counting bare PROGRESS records would
  // inflate the number with books the partner merely opened but never read a
  // chapter of (createProgressIfMissing seeds completedChapters: []), which their
  // own dashboard would call not_started. The not-completed half is the negation
  // of repo.summarizeProgress's completion predicate.
  const booksInProgress = progress.filter(
    (p) =>
      p.completedChapters.length > 0 && p.currentChapterNumber > p.completedChapters.length,
  ).length;

  return {
    pair,
    partner: {
      displayName,
      currentStreak: streak.currentStreak,
      booksInProgress,
      lastActiveDate: streak.lastActiveDate,
    },
  };
}

export async function deletePair(
  tableName: string,
  userId: string,
  partnerId: string,
): Promise<void> {
  const now = nowIso();
  // Soft-delete both sides (ConditionExpression prevents creating stub records)
  const update = (pk: string, sk: string) =>
    ddbDoc.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: "SET #s = :ended, endedAt = :now, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":ended": "ended", ":now": now },
        ConditionExpression: "attribute_exists(PK)",
      }),
    ).catch((err: unknown) => {
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
      if (name === "ConditionalCheckFailedException") return; // no-op if record doesn't exist
      throw err;
    });

  await Promise.all([
    update(bookUserPk(userId), pairSk(partnerId)),
    update(bookUserPk(partnerId), pairSk(userId)),
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
