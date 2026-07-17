/**
 * WP-E71 red-team — ATTACK 1: D7 ship-gate receipt tampering.
 *
 * A sealed D7 ship-gate receipt is the only thing that promotes a new/changed
 * book. This suite mutates each proof-bearing field of an OTHERWISE-VALID PASS
 * receipt — rater_route.model, rater_route.effort, rater_route.ultra_probe_sha256,
 * and custody.envelopeManifestSha256 — and asserts the pure gate decision
 * (`evaluateD7ShipGate`) FAILS CLOSED every time. Two mutation shapes are covered:
 *
 *   (a) a NAIVE tamper (change a field, keep the old binding_sha256) → the seal
 *       breaks (D7.receipt_tampered); and
 *   (b) a SELF-CONSISTENT FORGERY (change a field AND re-seal so binding_sha256
 *       matches) → `deriveRouteProof` still catches it structurally
 *       (D7.rater_route_invalid) / the custody-shape check still catches a
 *       malformed hash — because these checks compare the route's CONTENT to the
 *       authorized shape, not merely the receipt's internal consistency.
 *
 * Each test PASSES iff the defense holds (the tamper is blocked). A test that
 * FAILED would be a FINDING: a tampered receipt minting a shippable PASS.
 *
 * Pure/hermetic: `evaluateD7ShipGate` does no IO, no model. Nothing is written to
 * disk, so this stays clean under CHAPTERFLOW_LEAK_GUARD=1.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  evaluateD7ShipGate,
  sealD7ShipGateReceipt,
  D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION,
  D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE,
  D7_SHIP_GATE_RECEIPT_ISSUER,
  D7_RATER_ROUTE_FAMILY,
  D7_REAUTHOR_BUDGET_PER_AUDIT,
  type D7ShipGateReceiptV1,
  type D7CurrentContent,
} from "../src/critics/d7ShipGate.js";
import { RUBRIC_AUDIT_BAR_D7, RUBRIC_AUDIT_RUBRIC_VERSION } from "../src/bakeoff/migration/rubricAuditInstrument.js";
import { BASELINE_MODEL, SUPPORTED_MODEL_IDS } from "../src/orchestrator/modelPolicy.js";
import { ULTRA_EFFORT } from "../src/exec/ultraSession.js";

const BOOK = "zz-rt-book";
const UNIT = "zz-rt-book-ch01";
const AUDIT = "zzrtaudit";
const DOC_SHA = "a".repeat(64);
const HEADING_SHA = "b".repeat(64);
const PROBE_SHA = "c".repeat(64);

/** A well-formed, ship-eligible current-content map bound to the receipt. */
function currentContent(docSha = DOC_SHA): D7CurrentContent {
  return new Map([[UNIT, { chapterNumber: 1, contentDocSha256: docSha, headingInventorySha256: HEADING_SHA }]]);
}

/** The sealed-receipt CORE (minus binding_sha256) of a genuine PASS. */
function validCore(): Omit<D7ShipGateReceiptV1, "binding_sha256"> {
  return {
    schema_version: D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION,
    artifact_type: D7_SHIP_GATE_RECEIPT_ARTIFACT_TYPE,
    issuer: D7_SHIP_GATE_RECEIPT_ISSUER,
    book_id: BOOK,
    audit_id: AUDIT,
    round: 1,
    reauthor_budget_per_audit: D7_REAUTHOR_BUDGET_PER_AUDIT,
    instrument: { rubric_version: RUBRIC_AUDIT_RUBRIC_VERSION, bar: RUBRIC_AUDIT_BAR_D7 },
    verdict: "PASS",
    book_cds: 88,
    summary: {
      chapter_count: 1,
      mean: 88,
      min: 88,
      mean_pass: true,
      min_pass: true,
      all_core_domains_pass: true,
      all_gates_pass: true,
      all_layer_independence_pass: true,
      calibration_pass: true,
    },
    calibration: { unit: UNIT, expected: 88, observed: 88, abs_delta: 0, tolerance: RUBRIC_AUDIT_BAR_D7.calibrationTolerance, pass: true },
    chapters: [
      {
        unit: UNIT,
        chapterNumber: 1,
        chapterDiagnostic: 88,
        coreDomainMin: 3.5,
        coreDomainsPass: true,
        gatesPass: true,
        layerIndependencePass: true,
        pass: true,
        contentDocSha256: DOC_SHA,
        headingInventorySha256: HEADING_SHA,
      },
    ],
    custody: [
      {
        unit: UNIT,
        primaryDispatchSha256: "1".repeat(64),
        verificationDispatchSha256: "2".repeat(64),
        pairSealSha256: "3".repeat(64),
        adjudicationCanonicalSha256: "4".repeat(64),
        envelopeManifestSha256: "5".repeat(64),
      },
    ],
    report_sha256: "6".repeat(64),
    rater_route: { family: D7_RATER_ROUTE_FAMILY, model: BASELINE_MODEL, effort: ULTRA_EFFORT, ultra_probe_sha256: PROBE_SHA },
  };
}

function evalReceipt(receipt: D7ShipGateReceiptV1) {
  return evaluateD7ShipGate({
    bookId: BOOK,
    candidatePackageBytes: "CANDIDATE-BYTES-DIFFERENT-FROM-SHIPPED",
    shippedPackageBytes: null,
    receipt,
    currentContent: currentContent(),
    require: false,
  });
}

// ── Positive control: an untampered PASS receipt ships with proven route ───────
test("attack1 control: an untampered sealed PASS receipt passes the gate with a PROVEN route", () => {
  const receipt = sealD7ShipGateReceipt(validCore());
  const out = evalReceipt(receipt);
  assert.equal(out.decision, "pass", `expected pass, got ${out.decision}: ${out.reason}`);
  assert.equal(out.routeProof, "proven");
  assert.deepEqual(out.blockers, []);
});

// ── rater_route.model spoof ────────────────────────────────────────────────────
test("attack1: rater_route.model spoofed to a Claude id, self-consistently re-sealed → BLOCK (route invalid)", () => {
  const core = validCore();
  const forged = sealD7ShipGateReceipt({ ...core, rater_route: { ...core.rater_route!, model: "claude-opus-4-1" } });
  // The forger recomputed binding_sha256, so the seal is internally consistent…
  const out = evalReceipt(forged);
  // …but deriveRouteProof compares the model to SUPPORTED_MODEL_IDS, which never
  // contains a Claude id, so the route is INVALID and the gate blocks.
  assert.equal(out.decision, "block");
  assert.equal(out.routeProof, "invalid");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), out.reason);
  assert.ok(!SUPPORTED_MODEL_IDS.has("claude-opus-4-1"), "sanity: no Claude id is a supported model");
});

test("attack1: rater_route.model spoofed WITHOUT re-sealing → BLOCK (both tampered seal AND invalid route)", () => {
  const sealed = sealD7ShipGateReceipt(validCore());
  const naive: D7ShipGateReceiptV1 = { ...sealed, rater_route: { ...sealed.rater_route!, model: "claude-3-5-sonnet" } };
  const out = evalReceipt(naive);
  assert.equal(out.decision, "block");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.receipt_tampered")), "the broken seal is caught");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), "the Claude route is caught");
});

// ── rater_route.effort spoof ────────────────────────────────────────────────────
test("attack1: rater_route.effort spoofed from ultra to xhigh, re-sealed → BLOCK (route invalid)", () => {
  const core = validCore();
  const forged = sealD7ShipGateReceipt({ ...core, rater_route: { ...core.rater_route!, effort: "xhigh" } });
  const out = evalReceipt(forged);
  assert.equal(out.decision, "block");
  assert.equal(out.routeProof, "invalid");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), out.reason);
});

// ── rater_route.ultra_probe_sha256 spoof ────────────────────────────────────────
test("attack1: rater_route.ultra_probe_sha256 mutated to a non-sha string, re-sealed → BLOCK (route invalid)", () => {
  const core = validCore();
  const forged = sealD7ShipGateReceipt({ ...core, rater_route: { ...core.rater_route!, ultra_probe_sha256: "not-a-real-sha256" } });
  const out = evalReceipt(forged);
  assert.equal(out.decision, "block");
  assert.equal(out.routeProof, "invalid");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), out.reason);
});

// ── custody.envelopeManifestSha256 spoof (shape) ────────────────────────────────
test("attack1: custody.envelopeManifestSha256 mutated to a malformed value, re-sealed → BLOCK (custody shape)", () => {
  const core = validCore();
  const badCustody = core.custody.map((c) => ({ ...c, envelopeManifestSha256: "deadbeef" }));
  const forged = sealD7ShipGateReceipt({ ...core, custody: badCustody });
  const out = evalReceipt(forged);
  // A claimed-but-malformed envelope-manifest sha can never ship (defense in
  // depth; a well-formed-but-WRONG value is additionally caught against the
  // retained sidecar by verifyRetainedD7Custody, exercised elsewhere).
  assert.equal(out.decision, "block");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.custody_shape") && b.includes("envelopeManifestSha256")), out.reason);
});

// ── generic payload tamper without re-seal ──────────────────────────────────────
test("attack1: a non-route field mutated WITHOUT re-sealing (book_cds inflated) → BLOCK (receipt tampered)", () => {
  const sealed = sealD7ShipGateReceipt(validCore());
  const naive: D7ShipGateReceiptV1 = { ...sealed, book_cds: 999, summary: { ...sealed.summary, mean: 999 } };
  const out = evalReceipt(naive);
  assert.equal(out.decision, "block");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.receipt_tampered")), out.reason);
});

// ── a current-schema receipt with rater_route DELETED (claims proof it lacks) ───
test("attack1: a current-schema receipt with rater_route removed, re-sealed → BLOCK (route invalid, not silently proven)", () => {
  const core = validCore();
  const { rater_route: _drop, ...noRoute } = core;
  void _drop;
  // Re-seal so the binding is self-consistent — the ONLY thing wrong is a
  // current-schema receipt that carries no route proof.
  const forged = sealD7ShipGateReceipt(noRoute as Omit<D7ShipGateReceiptV1, "binding_sha256">);
  const out = evalReceipt(forged);
  assert.equal(out.decision, "block");
  assert.equal(out.routeProof, "invalid");
  assert.ok(out.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), out.reason);
});
