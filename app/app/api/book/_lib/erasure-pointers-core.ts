/**
 * Erasure reverse-pointers (#4a) — pure key construction/reconstruction.
 *
 * Externally-keyed records (risk events keyed by device/network fingerprint,
 * referral/pair codes, and Apple transaction maps) are unreachable from a sweep of
 * the user's own partition and there is no userId GSI to find them. To make them
 * erasable WITHOUT a GSI we write a small pointer item into the user's partition
 * at write time; this module owns BOTH directions so the target key the writer
 * records and the target key the eraser reconstructs are guaranteed byte-equal.
 *
 * Dependency-free (only imports the pure `keys.ts` builders) so it is unit
 * testable and shared verbatim by the write side (repo/flow-points/pair) and the
 * erase side (account-erasure).
 */
import {
  bookUserPk,
  riskEventPk,
  riskEventSk,
  riskEventPointerSk,
  referralCodePk,
  referralCodeSk,
  referralCodePointerSk,
  pairInvitePk,
  pairInviteSk,
  pairInvitePointerSk,
  appleOriginalTransactionPk,
  appleOriginalTransactionSk,
  appleOriginalTransactionPointerSk,
  accountStatusSk,
  type AppleStorageLane,
} from "./keys";

type DdbKey = { PK: string; SK: string };

/** A pointer item ready to Put into the user's partition. */
export type ErasurePointerItem = Record<string, unknown> & {
  PK: string;
  SK: string;
  entity: string;
  /** The external target this pointer lets erasure delete. */
  targetPK: string;
  targetSK: string;
};

// ─── Risk events ──────────────────────────────────────────────────────────────

export type RiskEventPointerInput = {
  userId: string;
  scope: string;
  fingerprint: string;
  createdAt: string;
  eventType: string;
};

/**
 * Build the user-partition pointer for one risk event. `targetPK/targetSK`
 * reconstruct `riskEventPk(scope, fingerprint)` / `riskEventSk(createdAt,
 * eventType, userId)` exactly as `recordRiskEvent` writes them.
 */
export function buildRiskEventPointer(input: RiskEventPointerInput): ErasurePointerItem {
  return {
    PK: bookUserPk(input.userId),
    SK: riskEventPointerSk(input.scope, input.fingerprint, input.createdAt, input.eventType),
    entity: "BOOK_RISK_EVENT_POINTER",
    targetPK: riskEventPk(input.scope, input.fingerprint),
    targetSK: riskEventSk(input.createdAt, input.eventType, input.userId),
    // Retained for forensics/debuggability; reconstruction uses target* only.
    scope: input.scope,
    fingerprint: input.fingerprint,
    createdAt: input.createdAt,
    eventType: input.eventType,
  };
}

// ─── Referral codes ───────────────────────────────────────────────────────────

/**
 * Build the user-partition pointer for the inviter's referral-code reverse-index
 * item. `targetPK/targetSK` reconstruct `referralCodePk(inviteCode)` /
 * `referralCodeSk()` exactly as `getOrCreateUserReferralProfile` writes them.
 */
export function buildReferralCodePointer(userId: string, inviteCode: string): ErasurePointerItem {
  return {
    PK: bookUserPk(userId),
    SK: referralCodePointerSk(inviteCode),
    entity: "BOOK_REFERRAL_CODE_POINTER",
    targetPK: referralCodePk(inviteCode),
    targetSK: referralCodeSk(),
    inviteCode,
  };
}

// ─── Pair invites ─────────────────────────────────────────────────────────────

/**
 * Build the user-partition pointer for one pair-invite reverse-index item.
 * `targetPK/targetSK` reconstruct `pairInvitePk(inviteCode)` / `pairInviteSk()`
 * exactly as `createPairInvite` writes them.
 */
export function buildPairInvitePointer(userId: string, inviteCode: string): ErasurePointerItem {
  return {
    PK: bookUserPk(userId),
    SK: pairInvitePointerSk(inviteCode),
    entity: "BOOK_PAIR_INVITE_POINTER",
    targetPK: pairInvitePk(inviteCode),
    targetSK: pairInviteSk(),
    inviteCode,
  };
}

// ─── Apple transaction reverse maps ──────────────────────────────────────────

/**
 * Build the user-owned pointer for an externally-keyed Apple transaction map.
 * The pointer is written atomically with the claim, allowing account erasure to
 * remove both the stored userId and the purchase reservation.
 */
export function buildAppleTransactionPointer(
  userId: string,
  originalTransactionId: string,
  storageLane: AppleStorageLane = "Primary",
): ErasurePointerItem {
  return {
    PK: bookUserPk(userId),
    SK: appleOriginalTransactionPointerSk(originalTransactionId, storageLane),
    entity: "BOOK_APPLE_TXN_POINTER",
    targetPK: appleOriginalTransactionPk(originalTransactionId, storageLane),
    targetSK: appleOriginalTransactionSk(),
    appleStorageLane: storageLane,
  };
}

// ─── Reconstruction (erase side) ──────────────────────────────────────────────

/** Entity discriminators for the #4a erasure reverse-pointer items (the SoT). */
const POINTER_ENTITIES = new Set([
  "BOOK_RISK_EVENT_POINTER",
  "BOOK_REFERRAL_CODE_POINTER",
  "BOOK_PAIR_INVITE_POINTER",
  "BOOK_APPLE_TXN_POINTER",
]);

/**
 * True iff `entity` marks one of the #4a erasure reverse-pointer items. Single
 * source of truth so other code (e.g. the legacy pair-invite harvest) can skip
 * pointer items rather than re-listing the entity strings and drifting.
 */
export function isErasurePointerEntity(entity: unknown): boolean {
  return typeof entity === "string" && POINTER_ENTITIES.has(entity);
}

/**
 * Given an item read from the user's partition, return the external target key
 * it points at, or null if it is not an erasure pointer. Reads the persisted
 * `targetPK`/`targetSK` directly (written by the build* functions above) so the
 * reconstruction is byte-exact by construction — no re-derivation drift.
 */
export function targetKeyFromPointer(item: Record<string, unknown>): DdbKey | null {
  if (!isErasurePointerEntity(item.entity)) return null;
  const targetPK = item.targetPK;
  const targetSK = item.targetSK;
  if (typeof targetPK !== "string" || typeof targetSK !== "string") return null;
  return { PK: targetPK, SK: targetSK };
}

/** Collect every external target key referenced by pointer items in a partition. */
export function targetKeysFromUserItems(items: Record<string, unknown>[]): DdbKey[] {
  const seen = new Set<string>();
  const keys: DdbKey[] = [];
  for (const it of items) {
    const target = targetKeyFromPointer(it);
    if (!target) continue;
    const dedupe = JSON.stringify([target.PK, target.SK]);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    keys.push(target);
  }
  return keys;
}

/**
 * Main-partition deletion gate. If any pointer target is unresolved, retain the
 * entire partition so its reverse pointers survive for an operator retry. Once
 * targets are gone, delete every well-formed row except the short-lived deleted
 * account tombstone that blocks stale tokens and racing claims.
 */
export function mainPartitionKeysAfterPointerCleanup(
  items: Record<string, unknown>[],
  pointerTargetsComplete: boolean,
): DdbKey[] {
  if (!pointerTargetsComplete) return [];
  return items
    .filter(
      (item) =>
        typeof item.PK === "string" &&
        typeof item.SK === "string" &&
        item.SK !== accountStatusSk(),
    )
    .map((item) => ({ PK: item.PK as string, SK: item.SK as string }));
}
