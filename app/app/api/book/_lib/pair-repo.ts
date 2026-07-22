import "server-only";

import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { bookUserPk, pairActiveSk, pairInvitePk, pairInviteSk, streakSk, nowIso } from "./keys";
import { buildPairInvitePointer } from "./erasure-pointers-core";
import { isTransactionConditionFailedAt } from "./errors";
import {
  ACCEPT_PAIR_CONDITION,
  NUDGE_DEDUP_CONDITION,
  buildActivePairItem,
  buildEndedPairHistoryItem,
  buildNudgeDedupItem,
} from "./pair-write-core";
import { getBookContentBucket } from "./env";
import { listPublishedLibraryCatalog } from "./library-catalog";
import { getUserProfileItem, listAllUserProgress } from "./repo";
import type { BookUserPairItem, BookPairInviteItem, BookUserProgress } from "./types";

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
      // Write the invite (keyed by code, OUTSIDE the user partition) AND an
      // erasure reverse-pointer into the inviter's partition (#4a), atomically,
      // so account-erasure can later reach and delete the invite. Forward-only:
      // only invites created after this deploy carry a pointer.
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: pairInvitePk(inviteCode),
                  SK: pairInviteSk(),
                  entity: "BOOK_PAIR_INVITE",
                  ...item,
                  ttl,
                },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Put: {
                // Stamp the SAME 7-day ttl as the invite target so the pointer is
                // reaped together with it (otherwise the pointer outlives the
                // reaped invite forever — dead per-user accumulation).
                TableName: tableName,
                Item: { ...buildPairInvitePointer(userId, inviteCode), ttl },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
        }),
      );
      return item;
    } catch (err: unknown) {
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
      // A code collision surfaces as ConditionalCheckFailed (legacy single-Put)
      // or, now that the invite + pointer write in one transaction, as
      // TransactionCanceledException — retry with a fresh code in either case.
      if (name === "ConditionalCheckFailedException" || name === "TransactionCanceledException") continue;
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

  // Best-effort early-exit (friendlier error than a generic "Invite already
  // used"), but NOT the correctness gate: this read is separate from the write,
  // so it can race. Atomicity is enforced below by the per-user singleton Put
  // condition, which is what actually prevents two active partners.
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

  // Commit all three writes atomically. Both pair Puts target each user's SINGLE
  // active-pair slot (`PAIR#ACTIVE`) and require it to be empty
  // (attribute_not_exists(SK)); the invite Put requires the invite to still be
  // pending. Because the slot is a FIXED per-user SK, a second concurrent accept
  // — even one pairing the user with a DIFFERENT partner — fails this condition,
  // cancelling the whole transaction (H6: at most one active partner). A prior
  // ended pair leaves no row on this slot, so re-pairing succeeds (H7).
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: buildActivePairItem(pairItem),
              ConditionExpression: ACCEPT_PAIR_CONDITION,
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: buildActivePairItem({
                userId: acceptingUserId,
                partnerId: invite.inviterUserId,
                pairedAt: now,
                createdAt: now,
                updatedAt: now,
              }),
              ConditionExpression: ACCEPT_PAIR_CONDITION,
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
      // Index-aligned with TransactItems above: 0 = inviter's active-pair slot,
      // 1 = accepting user's slot, 2 = invite-still-pending. A slot collision
      // (0/1) means that user already gained an active partner since the pre-read
      // — the H6 race — so report it precisely rather than as "Invite already used".
      if (isTransactionConditionFailedAt(err, 0)) {
        return { pair: null as never, error: "Inviter already has a partner" };
      }
      if (isTransactionConditionFailedAt(err, 1)) {
        return { pair: null as never, error: "You already have a partner" };
      }
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
  // The active pair lives at the single fixed `PAIR#ACTIVE` SK, so this is an
  // exact GetItem (no Query + in-memory status filter). Ended pairs are stored
  // under separate PAIRHISTORY# SKs and are never returned here.
  const result = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: bookUserPk(userId), SK: pairActiveSk() },
    }),
  );

  const item = result.Item as BookUserPairItem | undefined;
  return item && item.status === "active" ? item : null;
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
 * Map of bookId -> published chapter count, used to classify completion exactly
 * (mirroring repo.summarizeProgress, which compares completedChapters.length
 * against the book's real chapterCount). Read-only and best-effort.
 */
async function loadCatalogChapterCounts(tableName: string): Promise<Map<string, number>> {
  const contentBucket = await getBookContentBucket();
  const catalog = await listPublishedLibraryCatalog({ tableName, contentBucket });
  const counts = new Map<string, number>();
  for (const book of catalog) {
    if (Number.isFinite(book.chapterCount) && book.chapterCount > 0) {
      counts.set(book.id, book.chapterCount);
    }
  }
  return counts;
}

/**
 * Canonical in-progress predicate: started (completed > 0) AND not yet completed.
 * With the book's real chapterCount, completed === completedChapters.length >=
 * total (matches statusFromCounts / summarizeProgress and handles out-of-order
 * completion). When the count is unknown, fall back to summarizeProgress's
 * currentChapterNumber heuristic.
 */
function isBookInProgress(p: BookUserProgress, totalChapters: number | undefined): boolean {
  const completed = p.completedChapters.length;
  if (completed <= 0) return false;
  if (totalChapters !== undefined) {
    return completed < totalChapters;
  }
  return p.currentChapterNumber > completed;
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
  const [displayName, streak, progress, chapterCounts] = await Promise.all([
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
    // Per-book real chapter counts so completion is exact rather than inferred
    // from currentChapterNumber. Best-effort: a catalog read failure degrades to
    // the per-record heuristic below, never failing the whole pair request.
    loadCatalogChapterCounts(tableName).catch(() => new Map<string, number>()),
  ]);

  // "In progress" must mean started-with-real-activity AND not yet completed, to
  // match the app's canonical classifier (useBookAnalytics.statusFromCounts and
  // repo.summarizeProgress: in_progress === completed > 0 && completed < total).
  // Counting bare PROGRESS records would inflate the number with books the
  // partner merely opened but never read a chapter of (createProgressIfMissing
  // seeds completedChapters: []), which their own dashboard would call
  // not_started. Completion is keyed off the book's real chapterCount when known
  // — so a finished book (currentChapterNumber = last + 1) is excluded and a book
  // the reader jumped back into still counts — falling back to summarizeProgress's
  // currentChapterNumber heuristic only when the count is unavailable.
  const booksInProgress = progress.filter((p) =>
    isBookInProgress(p, chapterCounts.get(p.bookId)),
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
  // End BOTH sides. We DELETE the `PAIR#ACTIVE` marker (rather than soft-update it
  // in place) so the slot is free for the same two users to re-pair later (H7) —
  // the old soft-delete left a row that permanently failed the accept's
  // attribute_not_exists guard. The pre-delete state is preserved as an immutable
  // ended-history row under a distinct PAIRHISTORY# SK, so we keep the audit trail
  // without blocking the slot. Delete-then-put is one atomic TransactWrite per
  // side so we never strand a side with no active marker AND no history row.
  const endSide = (owner: string, other: string) =>
    ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: tableName,
              Key: { PK: bookUserPk(owner), SK: pairActiveSk() },
              // Only act when an active marker actually exists; a no-op otherwise.
              ConditionExpression: "attribute_exists(PK)",
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: buildEndedPairHistoryItem({
                userId: owner,
                partnerId: other,
                pairedAt: now,
                createdAt: now,
                endedAt: now,
              }),
            },
          },
        ],
      }),
    ).catch((err: unknown) => {
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
      // No active marker on this side → nothing to end; swallow so deletePair is
      // idempotent and a one-sided dangling record can still be cleaned up.
      if (name === "TransactionCanceledException" || name === "ConditionalCheckFailedException") return;
      throw err;
    });

  await Promise.all([endSide(userId, partnerId), endSide(partnerId, userId)]);
}

/**
 * Atomically claim today's one-nudge-per-partner slot. The daily cap is enforced
 * here as a CONDITIONAL write (`attribute_not_exists(SK)` on the per-day marker),
 * NOT a separate read-then-write — so two concurrent nudges to the same partner
 * can't both pass a stale "no marker yet" read and both deliver a notification
 * (H15). Returns true only for the writer that actually created the marker; a
 * loser (ConditionalCheckFailed) returns false and the caller treats it as the
 * `nudge_limit` (429) case. The marker carries a 2-day TTL so the slot self-clears.
 */
export async function recordNudgeSent(
  tableName: string,
  userId: string,
  partnerId: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const ttl = Math.floor(Date.now() / 1000) + 2 * 86400;
  try {
    await ddbDoc.send(
      new PutCommand({
        TableName: tableName,
        Item: buildNudgeDedupItem({
          userId,
          partnerId,
          dayKey: today,
          createdAt: nowIso(),
          ttl,
        }),
        ConditionExpression: NUDGE_DEDUP_CONDITION,
      }),
    );
    return true;
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : "";
    // The per-day marker already exists — either a same-day prior nudge or a
    // concurrent racer that won the slot. Either way this caller is over the cap.
    if (name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}
