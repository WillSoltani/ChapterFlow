/**
 * WP-E23 (P3, "a prompt string claiming Sol Ultra is not proof") — D7 ship-gate
 * RATER-ROUTE proof (unit).
 *
 * Proves:
 *  - a receipt minted/sealed WITH a rater_route round-trips through JSON and
 *    verifies "proven" — decision "pass", never blocked;
 *  - a self-consistently RE-SEALED tamper of rater_route (family/model/effort —
 *    the forger recomputes binding_sha256 too, so the seal alone cannot catch
 *    it) is independently caught by the STRUCTURAL route check and BLOCKS,
 *    reporting routeProof "invalid";
 *  - a receipt sealed under the RECOGNIZED LEGACY schema (no rater_route — the
 *    receipt predates route-proof) still PASSES when otherwise valid (matching
 *    tests/d7-ship-gate.test.ts's pre-existing PASS-path fixtures, which all
 *    predate this WP and must never break), but its routeProof is visibly
 *    "unproven" — never a silent "proven";
 *  - per-unit envelopeManifestSha256 custody: a genuine mint binds it, a clean
 *    retained sidecar re-verifies, and BOTH a tampered sidecar and a claimed-
 *    but-missing sidecar fail closed (D7.envelope_manifest_mismatch).
 *
 * Zero model/codex calls (fixture-driven, exactly like d7-ship-gate.test.ts).
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR } from "./helpers.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { artifactSha256FromText } from "../src/bakeoff/migration/rubricAuditCanonical.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  RUBRIC_CALIBRATION_REFERENCES,
  rubricAuditDirRelPath,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import { SUPPORTED_MODEL_IDS } from "../src/orchestrator/modelPolicy.js";
import { ULTRA_EFFORT } from "../src/exec/ultraSession.js";
import {
  D7_RATER_ROUTE_FAMILY,
  D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1,
  D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION,
  evaluateD7ShipGate,
  mintD7ShipGateReceiptFromAudit,
  sealD7ShipGateReceipt,
  verifyRetainedD7Custody,
  type D7CurrentContent,
  type D7ShipGateCustody,
  type D7ShipGateRaterRouteV1,
  type D7ShipGateReceiptV1,
} from "../src/critics/d7ShipGate.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const OWNER_RUN = resolve(REPOSITORY_ROOT, "docs/v25/rubric-audit-2026-07-15");
const SEALED_UNITS = [
  { unit: "nudge-ch03", score: 70.75657894736842 },
  { unit: "the-happiness-hypothesis-ch06", score: 68.8157894736842 },
  { unit: "made-to-stick-ch04", score: 67.66447368421052 },
];

const PROVEN_MODEL = [...SUPPORTED_MODEL_IDS][0]!;
const PROVEN_ROUTE: D7ShipGateRaterRouteV1 = {
  family: D7_RATER_ROUTE_FAMILY,
  model: PROVEN_MODEL,
  effort: ULTRA_EFFORT,
  ultra_probe_sha256: sha256Hex(Buffer.from("wp-e23-fixture-ultra-probe", "utf8")),
};

// ── Small in-memory fixtures (pure — no retained audit dir) ────────────────────

function currentContentFixture(bookId: string): D7CurrentContent {
  const out: D7CurrentContent = new Map();
  for (const n of [1, 2]) {
    const unit = `${bookId}-ch${String(n).padStart(2, "0")}`;
    out.set(unit, {
      chapterNumber: n,
      contentDocSha256: sha256Hex(Buffer.from(`${unit}-doc`, "utf8")),
      headingInventorySha256: sha256Hex(Buffer.from(`${unit}-headings`, "utf8")),
    });
  }
  return out;
}

function syntheticCustody(units: string[]): D7ShipGateCustody[] {
  return units.map((unit) => ({
    unit,
    primaryDispatchSha256: sha256Hex(Buffer.from(`${unit}-primary-dispatch`, "utf8")),
    verificationDispatchSha256: sha256Hex(Buffer.from(`${unit}-verification-dispatch`, "utf8")),
    pairSealSha256: sha256Hex(Buffer.from(`${unit}-pair-seal`, "utf8")),
    adjudicationCanonicalSha256: sha256Hex(Buffer.from(`${unit}-adjudication`, "utf8")),
  }));
}

/** Build + seal a PASS receipt over a current-content map, with or without a
 *  rater_route (mirrors tests/d7-ship-gate.test.ts's buildReceipt, minimized to
 *  this file's own need: only the PASS shape, +rater_route control). */
function buildPassReceipt(args: { bookId: string; content: D7CurrentContent; raterRoute?: D7ShipGateRaterRouteV1 }): D7ShipGateReceiptV1 {
  const chapters = [...args.content.entries()].map(([unit, entry]) => ({
    unit,
    chapterNumber: entry.chapterNumber,
    chapterDiagnostic: 90,
    coreDomainMin: 3.5,
    coreDomainsPass: true,
    gatesPass: true,
    layerIndependencePass: true,
    pass: true,
    contentDocSha256: entry.contentDocSha256,
    headingInventorySha256: entry.headingInventorySha256,
  }));
  return sealD7ShipGateReceipt({
    schema_version: args.raterRoute !== undefined ? D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION : D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1,
    artifact_type: "chapterflow_d7_ship_gate_receipt",
    issuer: "chapterflow_evaluation_orchestrator",
    book_id: args.bookId,
    audit_id: "zz-rater-route-fixture",
    round: 1,
    reauthor_budget_per_audit: 1,
    instrument: { rubric_version: "2.0", bar: RUBRIC_AUDIT_BAR_D7 },
    verdict: "PASS",
    book_cds: 90,
    summary: {
      chapter_count: chapters.length, mean: 90, min: 88, mean_pass: true, min_pass: true,
      all_core_domains_pass: true, all_gates_pass: true, all_layer_independence_pass: true, calibration_pass: true,
    },
    calibration: { unit: "made-to-stick-ch04", expected: 67.66, observed: 67.66, abs_delta: 0, tolerance: 3, pass: true },
    chapters,
    custody: syntheticCustody([...args.content.keys()]),
    report_sha256: "0".repeat(64),
    ...(args.raterRoute !== undefined ? { rater_route: args.raterRoute } : {}),
  });
}

test("receipt round-trip with rater_route: JSON round-trip preserves it byte-for-byte; the gate reports routeProof 'proven' and PASSES", () => {
  const content = currentContentFixture("zz-route-book");
  const receipt = buildPassReceipt({ bookId: "zz-route-book", content, raterRoute: PROVEN_ROUTE });
  assert.equal(receipt.schema_version, D7_SHIP_GATE_RECEIPT_SCHEMA_VERSION);

  const roundTripped = JSON.parse(JSON.stringify(receipt)) as D7ShipGateReceiptV1;
  assert.deepEqual(roundTripped.rater_route, PROVEN_ROUTE, "rater_route round-trips through JSON byte-for-byte");
  assert.equal(roundTripped.binding_sha256, receipt.binding_sha256);

  for (const require of [true, false]) {
    const r = evaluateD7ShipGate({
      bookId: "zz-route-book", candidatePackageBytes: "new", shippedPackageBytes: null,
      receipt: roundTripped, currentContent: content, require,
      // rt-401 finding A precedent (tests/d7-ship-gate.test.ts): REQUIRE mode
      // additionally mandates the retained audit dir be present — orthogonal to
      // route proof, so it is supplied "verified" here to isolate what THIS
      // test proves.
      ...(require ? { custodyVerification: { status: "verified" as const, blockers: [] } } : {}),
    });
    assert.equal(r.decision, "pass", r.reason);
    assert.equal(r.routeProof, "proven");
    assert.equal(r.blockers.length, 0);
  }
});

test("tampered rater_route → verification failure: a self-consistently RE-SEALED tamper (model swapped for a Claude string) is still caught — routeProof 'invalid', BLOCKED", () => {
  const content = currentContentFixture("zz-route-book");
  const genuine = buildPassReceipt({ bookId: "zz-route-book", content, raterRoute: PROVEN_ROUTE });

  // Strip binding_sha256, tamper rater_route.model, and RE-SEAL — a forger who
  // recomputes the binding hash so the seal alone stays internally consistent.
  const { binding_sha256: _drop, ...core } = genuine;
  const tampered = sealD7ShipGateReceipt({
    ...core,
    rater_route: { ...PROVEN_ROUTE, model: "claude-opus-4-8" },
  });
  assert.notEqual(tampered.binding_sha256, genuine.binding_sha256, "the forger's re-seal produces a DIFFERENT (but self-consistent) binding hash");

  for (const require of [true, false]) {
    const r = evaluateD7ShipGate({
      bookId: "zz-route-book", candidatePackageBytes: "new", shippedPackageBytes: null,
      receipt: tampered, currentContent: content, require,
    });
    assert.equal(r.decision, "block", `require=${require}`);
    assert.equal(r.routeProof, "invalid");
    assert.ok(r.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), r.blockers.join("; "));
  }
});

test("tampered rater_route → verification failure: family swapped to claude-side is also caught (not just the model string)", () => {
  const content = currentContentFixture("zz-route-book");
  const genuine = buildPassReceipt({ bookId: "zz-route-book", content, raterRoute: PROVEN_ROUTE });
  const { binding_sha256: _drop, ...core } = genuine;
  const tampered = sealD7ShipGateReceipt({
    ...core,
    rater_route: { ...PROVEN_ROUTE, family: "claude-side" as D7ShipGateRaterRouteV1["family"] },
  });
  const r = evaluateD7ShipGate({
    bookId: "zz-route-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt: tampered, currentContent: content, require: true,
  });
  assert.equal(r.decision, "block");
  assert.equal(r.routeProof, "invalid");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.rater_route_invalid")), r.blockers.join("; "));
});

test("legacy receipt → route-unproven status: a receipt with no rater_route (recognized legacy schema) still PASSES (matches every pre-WP-E23 fixture), but routeProof is visibly 'unproven', never silent", () => {
  const content = currentContentFixture("zz-route-book");
  const legacy = buildPassReceipt({ bookId: "zz-route-book", content }); // no raterRoute ⇒ legacy schema
  assert.equal(legacy.schema_version, D7_SHIP_GATE_RECEIPT_LEGACY_SCHEMA_VERSION_V1);
  assert.equal(legacy.rater_route, undefined);

  for (const require of [true, false]) {
    const r = evaluateD7ShipGate({
      bookId: "zz-route-book", candidatePackageBytes: "new", shippedPackageBytes: null,
      receipt: legacy, currentContent: content, require,
      ...(require ? { custodyVerification: { status: "verified" as const, blockers: [] } } : {}),
    });
    // Backward read-compat: a legacy receipt is never retroactively invalidated.
    assert.equal(r.decision, "pass", r.reason);
    assert.equal(r.blockers.length, 0);
    // But the route status is DISTINCT and VISIBLE — never a silent "proven".
    assert.equal(r.routeProof, "unproven");
    assert.match(r.reason, /UNPROVEN/, "the human-readable reason surfaces the unproven route too");
  }
});

// ── Per-unit envelopeManifestSha256 custody (mint + retained re-verification) ──

/** Materialize a real retained sealed-baseline audit dir (the FAIL-verdict
 *  three-chapter fixture tests/d7-ship-gate.test.ts also uses), optionally with
 *  an `adjudicator.envelope-manifest.json` sidecar per unit (WP-E23 route proof
 *  custody artifact). */
function materializeSealedAudit(roots: ReturnType<typeof mkTestRoots>, auditId: string, opts: { withEnvelopeManifest: boolean }): void {
  const auditDir = resolve(roots.base, rubricAuditDirRelPath(auditId));
  const write = (rel: string, text: string) => {
    const abs = resolve(auditDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  };
  const copyFromOwnerRun = (rel: string) => write(rel, readFileSync(resolve(OWNER_RUN, rel), "utf8"));
  const calibrationUnit = "made-to-stick-ch04";
  const manifest = {
    schema: "rubric-audit-batch-v1",
    auditId,
    purpose: "WP-E23 envelope-manifest custody check",
    rubricVersion: "2.0",
    bar: RUBRIC_AUDIT_BAR_D7,
    calibration: {
      unit: calibrationUnit,
      docRelPath: "x",
      docSha256: "0".repeat(64),
      ownerRunId: "20260715T110908Z",
      expectedChapterDiagnostic: SEALED_UNITS.find((u) => u.unit === calibrationUnit)!.score,
    },
    chapters: SEALED_UNITS.map((u, i) => ({
      unit: u.unit,
      bookId: "zz-envelope-manifest-book",
      chapterNumber: i + 1,
      chapterTitle: u.unit,
      packagePath: "x",
      packageBytesSha256: "0".repeat(64),
      docRelPath: `docs/${u.unit}.audit.md`,
      docSha256: sha256Hex(Buffer.from(`${u.unit}-doc`, "utf8")),
      headingInventorySha256: sha256Hex(Buffer.from(`${u.unit}-h`, "utf8")),
      layerDocs: {
        fast: { relPath: "x", sha256: "0".repeat(64) },
        deep: { relPath: "x", sha256: "0".repeat(64) },
        full: { relPath: "x", sha256: "0".repeat(64) },
      },
    })),
    manifestSha256: "0".repeat(64),
  };
  write("batch-manifest.json", JSON.stringify(manifest, null, 2));
  for (const u of SEALED_UNITS) {
    copyFromOwnerRun(`jobs/${u.unit}.inspection.json`);
    copyFromOwnerRun(`jobs/${u.unit}.receipts/primary.dispatch.json`);
    copyFromOwnerRun(`jobs/${u.unit}.receipts/verification.dispatch.json`);
    copyFromOwnerRun(`jobs/${u.unit}.receipts/pair.seal.json`);
    copyFromOwnerRun(`raw/primary/${u.unit}.json`);
    copyFromOwnerRun(`raw/verification/${u.unit}.json`);
    copyFromOwnerRun(`raw/adjudicated/${u.unit}.json`);
    if (opts.withEnvelopeManifest) {
      write(`jobs/${u.unit}.receipts/adjudicator.envelope-manifest.json`, JSON.stringify({
        schema_version: "1.0.0",
        artifact_type: "chapterflow_d7_envelope_manifest_binding",
        unit: u.unit,
        role: "adjudicator",
        envelope_manifest_sha256: sha256Hex(Buffer.from(`${u.unit}-fixture-envelope-manifest`, "utf8")),
        model: PROVEN_MODEL,
        effort: ULTRA_EFFORT,
      }));
    }
  }
  write(`calibration/${calibrationUnit}.adjudicated.json`,
    readFileSync(resolve(OWNER_RUN, `raw/adjudicated/${calibrationUnit}.json`), "utf8"));
  for (const reference of RUBRIC_CALIBRATION_REFERENCES) {
    const sourceDoc = readFileSync(resolve(REPOSITORY_ROOT, reference.docRelPath), "utf8");
    const target = resolve(roots.base, reference.docRelPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, sourceDoc);
  }
}

test("mintD7ShipGateReceiptFromAudit binds envelopeManifestSha256 per unit when the adjudicator sidecar is retained; verifyRetainedD7Custody re-verifies it clean", () => {
  const roots = mkTestRoots("wp-e23-envelope-manifest-clean");
  try {
    const auditId = "zz-envelope-manifest-clean";
    materializeSealedAudit(roots, auditId, { withEnvelopeManifest: true });
    const receipt = mintD7ShipGateReceiptFromAudit({ repositoryRoot: roots.base, auditId });
    assert.equal(receipt.custody.length, 3);
    for (const c of receipt.custody) {
      assert.match(c.envelopeManifestSha256 ?? "", /^[0-9a-f]{64}$/, `${c.unit} carries a well-formed envelopeManifestSha256`);
    }
    const custody = verifyRetainedD7Custody({ repositoryRoot: roots.base, receipt });
    assert.equal(custody.status, "verified", custody.blockers.join("; "));
    assert.equal(custody.blockers.length, 0);
  } finally {
    roots.dispose();
  }
});

test("mintD7ShipGateReceiptFromAudit: NO sidecar retained ⇒ envelopeManifestSha256 stays absent per unit (never fabricated, non-fail-closed at mint)", () => {
  const roots = mkTestRoots("wp-e23-envelope-manifest-absent");
  try {
    const auditId = "zz-envelope-manifest-absent";
    materializeSealedAudit(roots, auditId, { withEnvelopeManifest: false });
    const receipt = mintD7ShipGateReceiptFromAudit({ repositoryRoot: roots.base, auditId });
    for (const c of receipt.custody) assert.equal(c.envelopeManifestSha256, undefined);
  } finally {
    roots.dispose();
  }
});

test("D7.envelope_manifest_mismatch fails closed: a TAMPERED retained sidecar (bytes changed after minting) is caught at gate-time re-verification", () => {
  const roots = mkTestRoots("wp-e23-envelope-manifest-tamper");
  try {
    const auditId = "zz-envelope-manifest-tamper";
    materializeSealedAudit(roots, auditId, { withEnvelopeManifest: true });
    const receipt = mintD7ShipGateReceiptFromAudit({ repositoryRoot: roots.base, auditId }); // clean, valid custody
    const sidecarPath = resolve(roots.base, rubricAuditDirRelPath(auditId), "jobs/nudge-ch03.receipts/adjudicator.envelope-manifest.json");
    writeFileSync(sidecarPath, JSON.stringify({ tampered: true })); // change the retained bytes AFTER minting

    const custody = verifyRetainedD7Custody({ repositoryRoot: roots.base, receipt });
    assert.equal(custody.status, "failed");
    assert.ok(custody.blockers.some((b) => b.startsWith("D7.envelope_manifest_mismatch")), custody.blockers.join("; "));
  } finally {
    roots.dispose();
  }
});

test("D7.envelope_manifest_mismatch fails closed: a receipt CLAIMING an envelopeManifestSha256 whose retained sidecar was then DELETED is caught (claim with no backing)", () => {
  const roots = mkTestRoots("wp-e23-envelope-manifest-deleted");
  try {
    const auditId = "zz-envelope-manifest-deleted";
    materializeSealedAudit(roots, auditId, { withEnvelopeManifest: true });
    const receipt = mintD7ShipGateReceiptFromAudit({ repositoryRoot: roots.base, auditId });
    const sidecarPath = resolve(roots.base, rubricAuditDirRelPath(auditId), "jobs/made-to-stick-ch04.receipts/adjudicator.envelope-manifest.json");
    rmSync(sidecarPath);

    const custody = verifyRetainedD7Custody({ repositoryRoot: roots.base, receipt });
    assert.equal(custody.status, "failed");
    assert.ok(
      custody.blockers.some((b) => b.startsWith("D7.envelope_manifest_mismatch") && b.includes("no retained sidecar")),
      custody.blockers.join("; "),
    );
  } finally {
    roots.dispose();
  }
});
