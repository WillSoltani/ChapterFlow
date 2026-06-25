import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRiskEventPointer,
  buildReferralCodePointer,
  buildPairInvitePointer,
  targetKeyFromPointer,
  targetKeysFromUserItems,
  isErasurePointerEntity,
} from "./erasure-pointers-core";
import {
  bookUserPk,
  riskEventPk,
  riskEventSk,
  referralCodePk,
  referralCodeSk,
  pairInvitePk,
  pairInviteSk,
} from "./keys";

const USER = "user-sub-123";

// ─── Byte-exact target reconstruction (the load-bearing guarantee) ────────────
//
// The pointer's targetPK/targetSK MUST equal the keys the writers actually use,
// reconstructed via the same keys.ts builders. If these drift, account-erasure
// would delete the wrong key (or nothing) and silently leave PII behind.

test("risk-event pointer: target key == riskEventPk/Sk used by recordRiskEvent", () => {
  const input = {
    userId: USER,
    scope: "device",
    fingerprint: "fp-abcdef",
    createdAt: "2026-06-24T12:34:56.789Z",
    eventType: "free_unlock_granted",
  };
  const ptr = buildRiskEventPointer(input);

  // Pointer lives in the USER partition (so the sweep deletes it).
  assert.equal(ptr.PK, bookUserPk(USER));
  assert.equal(ptr.entity, "BOOK_RISK_EVENT_POINTER");

  // Target reconstructs the EXACT key recordRiskEvent writes.
  assert.equal(ptr.targetPK, riskEventPk(input.scope, input.fingerprint));
  assert.equal(ptr.targetSK, riskEventSk(input.createdAt, input.eventType, input.userId));

  // And targetKeyFromPointer round-trips it.
  assert.deepEqual(targetKeyFromPointer(ptr), {
    PK: riskEventPk(input.scope, input.fingerprint),
    SK: riskEventSk(input.createdAt, input.eventType, input.userId),
  });
});

test("risk-event scope is uppercased in PK exactly as riskEventPk does", () => {
  const ptr = buildRiskEventPointer({
    userId: USER,
    scope: "network_ua",
    fingerprint: "fp",
    createdAt: "2026-01-01T00:00:00.000Z",
    eventType: "onboarding_completed",
  });
  assert.equal(ptr.targetPK, riskEventPk("network_ua", "fp"));
  assert.ok(ptr.targetPK.includes("NETWORK_UA"));
});

test("referral-code pointer: target key == referralCodePk/Sk", () => {
  const code = "cf-abc-123"; // mixed case to exercise uppercasing
  const ptr = buildReferralCodePointer(USER, code);
  assert.equal(ptr.PK, bookUserPk(USER));
  assert.equal(ptr.targetPK, referralCodePk(code));
  assert.equal(ptr.targetSK, referralCodeSk());
  assert.deepEqual(targetKeyFromPointer(ptr), {
    PK: referralCodePk(code),
    SK: referralCodeSk(),
  });
});

test("pair-invite pointer: target key == pairInvitePk/Sk", () => {
  const code = "GHJKLMNP";
  const ptr = buildPairInvitePointer(USER, code);
  assert.equal(ptr.PK, bookUserPk(USER));
  assert.equal(ptr.targetPK, pairInvitePk(code));
  assert.equal(ptr.targetSK, pairInviteSk());
  assert.deepEqual(targetKeyFromPointer(ptr), {
    PK: pairInvitePk(code),
    SK: pairInviteSk(),
  });
});

// ─── targetKeyFromPointer / targetKeysFromUserItems behavior ──────────────────

test("non-pointer items yield no target", () => {
  assert.equal(targetKeyFromPointer({ entity: "BOOK_USER_PAIR", PK: "x", SK: "y" }), null);
  assert.equal(targetKeyFromPointer({ entity: "BOOK_PROGRESS" }), null);
  assert.equal(targetKeyFromPointer({}), null);
});

test("pointer with missing targetPK/targetSK is ignored (no malformed delete)", () => {
  assert.equal(targetKeyFromPointer({ entity: "BOOK_RISK_EVENT_POINTER" }), null);
  assert.equal(
    targetKeyFromPointer({ entity: "BOOK_RISK_EVENT_POINTER", targetPK: 42, targetSK: "x" }),
    null,
  );
});

test("targetKeysFromUserItems collects all pointer targets and dedupes", () => {
  const ptrA = buildRiskEventPointer({
    userId: USER,
    scope: "device",
    fingerprint: "fp1",
    createdAt: "2026-06-24T00:00:00.000Z",
    eventType: "free_unlock_granted",
  });
  const ptrB = buildReferralCodePointer(USER, "CODE1");
  const ptrC = buildPairInvitePointer(USER, "INVITE1");
  const noise = { entity: "BOOK_PROGRESS", PK: bookUserPk(USER), SK: "PROGRESS#x" };

  const keys = targetKeysFromUserItems([ptrA, ptrB, ptrC, noise, { ...ptrA }]);
  assert.equal(keys.length, 3, "duplicate ptrA collapsed");
  assert.ok(keys.some((k) => k.PK === ptrA.targetPK && k.SK === ptrA.targetSK));
  assert.ok(keys.some((k) => k.PK === ptrB.targetPK && k.SK === ptrB.targetSK));
  assert.ok(keys.some((k) => k.PK === ptrC.targetPK && k.SK === ptrC.targetSK));
});

// ─── isErasurePointerEntity (C7 — single source of truth for pointer entities) ─

test("isErasurePointerEntity: recognizes all three pointer entities, rejects others", () => {
  assert.equal(isErasurePointerEntity("BOOK_RISK_EVENT_POINTER"), true);
  assert.equal(isErasurePointerEntity("BOOK_REFERRAL_CODE_POINTER"), true);
  assert.equal(isErasurePointerEntity("BOOK_PAIR_INVITE_POINTER"), true);
  // A real pair invite / referral item (non-pointer) and noise must be rejected,
  // so the legacy inviteCode harvest does NOT skip genuine legacy items.
  assert.equal(isErasurePointerEntity("BOOK_USER_PAIR"), false);
  assert.equal(isErasurePointerEntity("BOOK_PROGRESS"), false);
  assert.equal(isErasurePointerEntity(undefined), false);
  assert.equal(isErasurePointerEntity(42), false);
});

test("the built pointers all report as pointer entities (keeps the harvest skip in sync)", () => {
  assert.equal(isErasurePointerEntity(buildRiskEventPointer({
    userId: USER, scope: "device", fingerprint: "fp", createdAt: "2026-01-01T00:00:00Z", eventType: "signup",
  }).entity), true);
  assert.equal(isErasurePointerEntity(buildReferralCodePointer(USER, "CODE1").entity), true);
  assert.equal(isErasurePointerEntity(buildPairInvitePointer(USER, "INVITE1").entity), true);
});
