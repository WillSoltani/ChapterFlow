/**
 * Finding #2 — Contested science stated as settled fact (SOURCE half).
 *
 * A claim can be perfectly faithful to the source book and still be DISPUTED in its
 * field (ego depletion / the glucose model of willpower, the marshmallow test, power
 * posing). Because the prose is faithful, the QC `factual_accuracy` read scores it
 * clean — so the only place to catch it is at the SOURCE. This finding adds an
 * OPTIONAL `testableFacts[].replicationStatus` the researcher sets at STEP-1, which
 * arms STEP-2 R9 (writer must hedge a contested claim) and feeds the WT-E
 * `factual_accuracy` scorer.
 *
 * This file pins the SCHEMA contract for the new field:
 *   (a) every valid value round-trips through evaluateSourceV2Integrity untouched and
 *       fires nothing (MUST_NOT_FIRE);
 *   (b) absence is silent and the field cannot brick a sidecar (MUST_NOT_FIRE);
 *   (c) a present-but-invalid value fires the advisory typo guard
 *       `SV2.replication_status_invalid` — a TRUE_POSITIVE — without blocking (it is
 *       advisory: a typo must surface, never fail-close a structurally valid sidecar);
 *   (d) gold zero-FP: the clean synthetic gold sidecar (no field) is silent.
 *
 * The PROSE scoring test (does the writer actually hedge?) is irreducibly semantic and
 * lives in WT-E's `factual_accuracy` rubric — not here.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeSourceV2SidecarFixture } from "./helpers.js";
import { evaluateSourceV2Integrity } from "../src/source/sourceIntegrity.js";
import { REPLICATION_STATUSES, type ReplicationStatus } from "../src/source/sidecarSchema.js";

const REPLICATION_FINDING = "SV2.replication_status_invalid";

/** A structurally-clean source-v2 sidecar (the synthetic gold), with an optional
 *  override applied to the FIRST testableFact's replicationStatus. */
function sidecarWithStatus(replicationStatus?: unknown): any {
  const sc = makeSourceV2SidecarFixture({ chapterNumber: 1, chapterTitle: "Willpower Budget" });
  if (replicationStatus !== undefined) {
    sc.testableFacts[0] = { ...sc.testableFacts[0], replicationStatus };
  }
  return sc;
}

function replicationFindings(sc: unknown): string[] {
  return evaluateSourceV2Integrity(sc, { chapterNumber: 1 })
    .findings.filter((f) => f.checkId === REPLICATION_FINDING)
    .map((f) => f.message);
}

// ── (a) every valid value round-trips and fires nothing (MUST_NOT_FIRE) ──────────
test("each valid replicationStatus round-trips through evaluateSourceV2Integrity and fires nothing", () => {
  for (const status of REPLICATION_STATUSES) {
    const decision = evaluateSourceV2Integrity(sidecarWithStatus(status), { chapterNumber: 1 });
    assert.equal(decision.passed, true, `valid replicationStatus ${JSON.stringify(status)} must keep the sidecar structurally valid`);
    assert.ok(decision.sidecar, `valid replicationStatus ${JSON.stringify(status)} must yield a sidecar`);
    // The field is preserved verbatim on the validated sidecar (round-trip).
    assert.equal(
      (decision.sidecar!.testableFacts[0] as { replicationStatus?: ReplicationStatus }).replicationStatus,
      status,
      `replicationStatus ${JSON.stringify(status)} must round-trip onto the validated sidecar`,
    );
    assert.deepEqual(
      decision.findings.filter((f) => f.checkId === REPLICATION_FINDING),
      [],
      `a valid replicationStatus ${JSON.stringify(status)} must not fire ${REPLICATION_FINDING}`,
    );
  }
});

// ── (b) absence is silent and never bricks a sidecar (MUST_NOT_FIRE) ─────────────
test("an absent replicationStatus is silent — the field is optional and additive", () => {
  const decision = evaluateSourceV2Integrity(sidecarWithStatus(undefined), { chapterNumber: 1 });
  assert.equal(decision.passed, true, "the gold fixture without the field must stay structurally valid");
  assert.equal(
    (decision.sidecar!.testableFacts[0] as { replicationStatus?: ReplicationStatus }).replicationStatus,
    undefined,
    "absence must round-trip as absence (not assessed ⇒ treated as robust downstream)",
  );
  assert.deepEqual(replicationFindings(decision.sidecar), [], "absence must never fire the typo guard");
});

// ── (c) a present-but-invalid value fires the advisory typo guard (TRUE_POSITIVE) ─
const INVALID_STATUSES: unknown[] = [
  "disputed", // a plausible synonym a researcher might type instead of "contested"
  "contested ", // trailing whitespace — exact-match enum, so this is a typo
  "Robust", // wrong case
  "weak",
  true, // wrong type
  "", // empty string is not "omitted"
];

test("a present-but-invalid replicationStatus fires SV2.replication_status_invalid (advisory, never blocking)", () => {
  for (const bad of INVALID_STATUSES) {
    const decision = evaluateSourceV2Integrity(sidecarWithStatus(bad), { chapterNumber: 1 });
    const fired = decision.findings.filter((f) => f.checkId === REPLICATION_FINDING);
    assert.equal(fired.length, 1, `invalid replicationStatus ${JSON.stringify(bad)} must fire exactly one ${REPLICATION_FINDING}`);
    assert.equal(fired[0].severity, "advisory", "the typo guard must be ADVISORY — a researcher typo surfaces, it never fail-closes a structurally valid sidecar");
    // A bad replicationStatus must NOT, on its own, invalidate an otherwise-clean sidecar.
    assert.equal(decision.passed, true, `invalid replicationStatus ${JSON.stringify(bad)} must not block (passed reflects blockers only)`);
  }
});

// ── (d) gold zero-FP: the clean synthetic gold sidecar is silent ─────────────────
test("gold zero-FP: the clean synthetic gold sidecar emits no replication-status finding", () => {
  for (const n of [1, 2, 3]) {
    const sc = makeSourceV2SidecarFixture({ chapterNumber: n, chapterTitle: `Gold Chapter ${n}` });
    const fired = evaluateSourceV2Integrity(sc, { chapterNumber: n }).findings.filter((f) => f.checkId === REPLICATION_FINDING);
    assert.deepEqual(fired, [], `gold chapter ${n} must be zero-FP for ${REPLICATION_FINDING}`);
  }
});
