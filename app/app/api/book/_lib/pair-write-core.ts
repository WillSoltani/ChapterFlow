/**
 * Reading-partner write logic (Feature #7) — pure, dependency-free core.
 *
 * Extracted from `pair-repo.ts` so the singleton/atomicity invariants can be
 * unit-tested without importing the `server-only`-guarded repo (which throws at
 * test import). Owns the DynamoDB key shape and the TransactWrite item shapes for
 * accepting and ending a pair; the repo wraps these with the AWS SDK calls.
 *
 * Two invariants this module exists to keep honest:
 *
 *  (H6) A user can have AT MOST ONE active partner. The active pair lives at a
 *       single FIXED SK per user (`PAIR#ACTIVE`), not at a partner-specific SK.
 *       The accept Put guards on `attribute_not_exists(SK)`, so a second
 *       concurrent accept (even with a DIFFERENT partner) fails the condition and
 *       the whole transaction cancels — the singleton is enforced at the item
 *       level, atomically, not by a non-atomic pre-read.
 *
 *  (H7) Ending a pair must NOT permanently block the same two users from
 *       re-pairing. `deletePair` DELETES the `PAIR#ACTIVE` marker (and records an
 *       immutable ended-history row under a distinct SK for the audit trail), so
 *       a later accept can write a fresh `PAIR#ACTIVE` without colliding with a
 *       stale soft-deleted row.
 */
import { bookUserPk, pairActiveSk, pairHistorySk } from "./keys";

export type PairSide = {
  userId: string;
  partnerId: string;
  pairedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DdbPutItem = Record<string, unknown> & { PK: string; SK: string; entity: string };

/**
 * The active-pair item for one side of a pair. Both sides share the SAME fixed
 * SK (`PAIR#ACTIVE`) in their own partition, so each user can hold at most one.
 * `status` is forced to "active" — an active-pair row by definition.
 */
export function buildActivePairItem(side: PairSide): DdbPutItem {
  return {
    PK: bookUserPk(side.userId),
    SK: pairActiveSk(),
    entity: "BOOK_USER_PAIR",
    userId: side.userId,
    partnerId: side.partnerId,
    pairedAt: side.pairedAt,
    status: "active",
    createdAt: side.createdAt,
    updatedAt: side.updatedAt,
  };
}

/**
 * An immutable ended-pair history row, written when a pair is dissolved. Keyed by
 * (partnerId, endedAt) so repeated pairings with the same partner each leave a
 * distinct audit row and NONE of them sit on `PAIR#ACTIVE` (which must stay free
 * for re-pairing). Lives in the user's own partition so account-erasure's
 * partition sweep removes it.
 */
export function buildEndedPairHistoryItem(input: {
  userId: string;
  partnerId: string;
  pairedAt: string;
  createdAt: string;
  endedAt: string;
}): DdbPutItem {
  return {
    PK: bookUserPk(input.userId),
    SK: pairHistorySk(input.partnerId, input.endedAt),
    entity: "BOOK_USER_PAIR_HISTORY",
    userId: input.userId,
    partnerId: input.partnerId,
    pairedAt: input.pairedAt,
    status: "ended",
    createdAt: input.createdAt,
    endedAt: input.endedAt,
    updatedAt: input.endedAt,
  };
}

/**
 * ConditionExpression for an accept Put: the active-pair slot must be empty. This
 * is the H6 singleton guard — `attribute_not_exists(SK)` on the FIXED `PAIR#ACTIVE`
 * SK rejects any second active pair for the same user, regardless of partner.
 */
export const ACCEPT_PAIR_CONDITION = "attribute_not_exists(SK)";
