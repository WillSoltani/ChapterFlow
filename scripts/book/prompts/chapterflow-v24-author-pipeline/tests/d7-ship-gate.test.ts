/**
 * WP-401 — D7 rubric-audit SHIP GATE (unit).
 *
 * Model-free, fixture-driven proofs of the gate brain:
 *  - the byte-identity no-retroactivity exemption,
 *  - REQUIRE vs advisory handling of a MISSING receipt,
 *  - a PRESENT receipt bound to current content PASSES; FAIL / VOID / stale /
 *    tampered / instrument-drift / book-mismatch / corrupt all BLOCK (never fail
 *    open),
 *  - the D-8 on-fail policy DATA (one full re-author round, then a terminal owner
 *    halt at round 2),
 *  - minting: the receipt CONSUMES an adjudicated audit and faithfully carries the
 *    bar verdict — proven against the three sealed-baseline chapters (67–70), whose
 *    receipt verdict FAILS (the gate would reject sub-bar content).
 *
 * Zero model/codex calls (asserted structurally: the gate imports no runner).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";
import { PIPELINE_DIR, makeGateCleanChapter } from "./helpers.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { chapterFileName } from "../src/lib/chapterPaths.js";
import {
  RUBRIC_AUDIT_BAR_D7,
  buildRubricAuditReport,
  rubricAuditDirRelPath,
  type RubricAuditBatchManifestV1,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";
import {
  D7_REAUTHOR_BUDGET_PER_AUDIT,
  buildD7ShipGateReceiptCore,
  deriveCurrentD7Content,
  evaluateD7ShipGate,
  mintD7ShipGateReceiptFromAudit,
  sealD7ShipGateReceipt,
  type D7CurrentContent,
  type D7ShipGateReceiptV1,
  type D7ShipGateVerdict,
} from "../src/critics/d7ShipGate.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const OWNER_RUN = resolve(REPOSITORY_ROOT, "docs/v25/rubric-audit-2026-07-15");
const SEALED_UNITS = [
  { unit: "nudge-ch03", score: 70.75657894736842 },
  { unit: "the-happiness-hypothesis-ch06", score: 68.8157894736842 },
  { unit: "made-to-stick-ch04", score: 67.66447368421052 },
];

// ── Synthetic-content + receipt builders ──────────────────────────────────────

/** A tiny 2-chapter current-content map (unit → doc hashes). */
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

/** Build a sealed receipt over a current-content map. `verdict` drives per-chapter
 *  pass; `contentDocSha256Override` (per unit) stales a binding. */
function buildReceipt(args: {
  bookId: string;
  content: D7CurrentContent;
  verdict: D7ShipGateVerdict;
  round?: number;
  contentDocSha256Override?: Map<string, string>;
}): D7ShipGateReceiptV1 {
  const pass = args.verdict === "PASS";
  const chapters = [...args.content.entries()].map(([unit, entry]) => ({
    unit,
    chapterNumber: entry.chapterNumber,
    chapterDiagnostic: pass ? 90 : 69,
    coreDomainMin: pass ? 3.5 : 2.0,
    coreDomainsPass: pass,
    gatesPass: true,
    layerIndependencePass: pass,
    pass,
    contentDocSha256: args.contentDocSha256Override?.get(unit) ?? entry.contentDocSha256,
    headingInventorySha256: entry.headingInventorySha256,
  }));
  const mean = pass ? 90 : 69;
  const min = pass ? 88 : 67.66;
  return sealD7ShipGateReceipt({
    schema_version: "1.0.0",
    artifact_type: "chapterflow_d7_ship_gate_receipt",
    issuer: "chapterflow_evaluation_orchestrator",
    book_id: args.bookId,
    audit_id: "zz-d7-audit",
    round: args.round ?? 1,
    reauthor_budget_per_audit: D7_REAUTHOR_BUDGET_PER_AUDIT,
    instrument: { rubric_version: "2.0", bar: RUBRIC_AUDIT_BAR_D7 },
    verdict: args.verdict,
    book_cds: mean,
    summary: {
      chapter_count: chapters.length,
      mean,
      min,
      mean_pass: pass,
      min_pass: pass,
      all_core_domains_pass: pass,
      all_gates_pass: true,
      all_layer_independence_pass: pass,
      calibration_pass: true,
    },
    calibration: { unit: "made-to-stick-ch04", expected: 67.66, observed: 67.66, abs_delta: 0, tolerance: 3, pass: true },
    chapters,
    custody: [],
    report_sha256: "0".repeat(64),
  });
}

// ── Exemption + require semantics ─────────────────────────────────────────────

test("D7 gate: a candidate byte-identical to the shipped corpus package is EXEMPT (no-retroactivity)", () => {
  const bytes = `{"schemaVersion":"chapterflow-book-v21","packageId":"x"}`;
  const r = evaluateD7ShipGate({
    bookId: "some-historical-book",
    candidatePackageBytes: bytes,
    shippedPackageBytes: bytes,
    receipt: null,
    currentContent: null,
    require: true, // even in REQUIRE mode, an unchanged re-promote is exempt
  });
  assert.equal(r.decision, "exempt");
  assert.equal(r.blockers.length, 0);
});

test("D7 gate: a MISSING receipt blocks only in REQUIRE mode; advisory otherwise", () => {
  const base = {
    bookId: "zz-new-book",
    candidatePackageBytes: "new",
    shippedPackageBytes: null,
    receipt: null,
    currentContent: null,
  };
  const advisory = evaluateD7ShipGate({ ...base, require: false });
  assert.equal(advisory.decision, "advisory-skip");
  assert.equal(advisory.blockers.length, 0);

  const required = evaluateD7ShipGate({ ...base, require: true });
  assert.equal(required.decision, "block");
  assert.ok(required.blockers.some((b) => b.startsWith("D7.receipt_missing")), required.blockers.join("; "));
  assert.equal(required.halt, null, "a missing receipt is not a quality-bar FAIL, so no re-author halt");
});

test("D7 gate: a corrupt receipt file blocks even without REQUIRE (never fail-open)", () => {
  const r = evaluateD7ShipGate({
    bookId: "zz-book",
    candidatePackageBytes: "new",
    shippedPackageBytes: null,
    receipt: null,
    receiptCorrupt: true,
    currentContent: null,
    require: false,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.receipt_corrupt")));
});

// ── Present-receipt validation ────────────────────────────────────────────────

test("D7 gate: a PASS receipt bound to the current content passes", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "PASS" });
  const r = evaluateD7ShipGate({
    bookId: "zz-book",
    candidatePackageBytes: "new",
    shippedPackageBytes: null,
    receipt,
    currentContent: content,
    require: true,
  });
  assert.equal(r.decision, "pass", r.reason);
  assert.equal(r.blockers.length, 0);
  assert.equal(r.verdict, "PASS");
});

test("D7 gate: a FAIL receipt blocks and emits a one-round re-author halt (round 1)", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "FAIL", round: 1 });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: content, require: false, // present-bad blocks regardless of require
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.quality_bar_failed")));
  assert.ok(r.halt, "a FAIL verdict emits a halt record");
  assert.equal(r.halt!.halt_category, "BLOCKED_QUALITY_BAR");
  assert.equal(r.halt!.re_author_directive.allowed_reauthors, 1, "round 1 owes one full re-author");
  assert.equal(r.halt!.re_author_directive.terminal, false);
  assert.equal(r.halt!.failing_chapters.length, content.size);
});

test("D7 gate: a VOID_CALIBRATION receipt blocks", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "VOID_CALIBRATION" });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: content, require: false,
  });
  assert.equal(r.decision, "block");
  assert.equal(r.verdict, "VOID_CALIBRATION");
  assert.ok(r.halt, "VOID also emits the quality-bar halt");
});

test("D7 gate: one-round policy — a second FAIL (round 2) is a terminal owner halt", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "FAIL", round: 2 });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: content, require: false,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.halt);
  assert.equal(r.halt!.re_author_directive.terminal, true, "round 2 exhausts the single re-author budget");
  assert.equal(r.halt!.re_author_directive.allowed_reauthors, 0);
  assert.equal(r.halt!.round, 2);
});

test("D7 gate: a receipt bound to STALE bytes (wrong content hash) blocks", () => {
  const content = currentContentFixture("zz-book");
  const override = new Map([[`zz-book-ch01`, "f".repeat(64)]]);
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "PASS", contentDocSha256Override: override });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: content, require: true,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.stale_content")), r.blockers.join("; "));
});

test("D7 gate: a receipt covering a different chapter SET is stale (a shipped chapter is unaudited)", () => {
  const content = currentContentFixture("zz-book"); // ch01, ch02
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "PASS" });
  // Book now ships a third chapter the receipt never audited.
  const grown: D7CurrentContent = new Map(content);
  grown.set("zz-book-ch03", { chapterNumber: 3, contentDocSha256: "a".repeat(64), headingInventorySha256: "b".repeat(64) });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: grown, require: true,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.stale_content")));
});

test("D7 gate: a tampered receipt (bad binding_sha256) blocks", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "PASS" });
  const tampered: D7ShipGateReceiptV1 = { ...receipt, book_cds: receipt.book_cds + 1 }; // payload changed, hash not
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt: tampered, currentContent: content, require: true,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.receipt_tampered")));
});

test("D7 gate: an instrument-drift receipt (bar changed) blocks", () => {
  const content = currentContentFixture("zz-book");
  const base = buildReceipt({ bookId: "zz-book", content, verdict: "PASS" });
  // Re-seal with a weakened bar so binding stays valid but the instrument drifts.
  const drifted = sealD7ShipGateReceipt({
    ...base,
    instrument: { rubric_version: "2.0", bar: { ...RUBRIC_AUDIT_BAR_D7, meanMin: 50 } },
  } as Omit<D7ShipGateReceiptV1, "binding_sha256">);
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt: drifted, currentContent: content, require: true,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.instrument_mismatch")), r.blockers.join("; "));
});

test("D7 gate: a receipt for a different book blocks", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "some-other-book", content, verdict: "PASS" });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: content, require: true,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.book_mismatch")));
});

test("D7 gate: a present receipt whose current content cannot be derived blocks (fail-closed)", () => {
  const content = currentContentFixture("zz-book");
  const receipt = buildReceipt({ bookId: "zz-book", content, verdict: "PASS" });
  const r = evaluateD7ShipGate({
    bookId: "zz-book", candidatePackageBytes: "new", shippedPackageBytes: null,
    receipt, currentContent: null, require: false,
  });
  assert.equal(r.decision, "block");
  assert.ok(r.blockers.some((b) => b.startsWith("D7.content_underivable")));
});

// ── Content re-derivation matches the audit-doc hash ──────────────────────────

test("deriveCurrentD7Content reproduces the app-faithful audit-doc hash for a real chapter", () => {
  const roots = mkTestRoots("wp401-derive");
  try {
    const chaptersDir = resolve(roots.base, "chapters");
    mkdirSync(chaptersDir, { recursive: true });
    const bookId = "zz-d7-derive";
    const chapter = makeGateCleanChapter(bookId, 1);
    writeFileSync(resolve(chaptersDir, chapterFileName(chapter.chapterId)), JSON.stringify(chapter));
    const content = deriveCurrentD7Content({ bookId, chaptersDir });
    const entry = content.get(`${bookId}-ch01`);
    assert.ok(entry, "the single chapter is derived");
    assert.match(entry!.contentDocSha256, /^[0-9a-f]{64}$/);
    // Deterministic: a second derivation is byte-stable.
    const again = deriveCurrentD7Content({ bookId, chaptersDir });
    assert.equal(again.get(`${bookId}-ch01`)!.contentDocSha256, entry!.contentDocSha256);
  } finally {
    roots.dispose();
  }
});

// ── Minting: bar arithmetic against the sealed-baseline 67–70 chapters ────────

/** Build a temp audit dir wiring the three owner-adjudicated sealed chapters as a
 *  single 3-chapter "book" batch, so the mint consumes REAL adjudications. */
function materializeSealedFailAudit(roots: ReturnType<typeof mkTestRoots>, auditId: string): void {
  const auditDir = resolve(roots.base, rubricAuditDirRelPath(auditId));
  const write = (rel: string, text: string) => {
    const abs = resolve(auditDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  };
  const calibrationUnit = "made-to-stick-ch04";
  const manifest = {
    schema: "rubric-audit-batch-v1",
    auditId,
    purpose: "wp401 sealed-baseline mint check",
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
      bookId: "zz-sealed-baseline-book",
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
    const adjudicated = readFileSync(resolve(OWNER_RUN, `raw/adjudicated/${u.unit}.json`), "utf8");
    write(`raw/adjudicated/${u.unit}.json`, adjudicated);
    write(`jobs/${u.unit}.receipts/primary.dispatch.json`, "{}");
    write(`jobs/${u.unit}.receipts/verification.dispatch.json`, "{}");
    write(`jobs/${u.unit}.receipts/pair.seal.json`, "{}");
  }
  write(`calibration/${calibrationUnit}.adjudicated.json`,
    readFileSync(resolve(OWNER_RUN, `raw/adjudicated/${calibrationUnit}.json`), "utf8"));
}

test("mintD7ShipGateReceiptFromAudit: the three sealed-baseline chapters (67–70) mint a FAIL receipt — the gate would reject sub-bar content", () => {
  const roots = mkTestRoots("wp401-mint-fail");
  try {
    const auditId = "zz-sealed-baseline-fail";
    materializeSealedFailAudit(roots, auditId);
    const receipt = mintD7ShipGateReceiptFromAudit({ repositoryRoot: roots.base, auditId });

    assert.equal(receipt.verdict, "FAIL", "scores 67–70 are below the 80/85 bar → FAIL");
    assert.ok(receipt.book_cds < 70 && receipt.book_cds > 69, `book CDS (mean) ≈ 69, got ${receipt.book_cds}`);
    assert.ok(receipt.summary.min < 68, `min ≈ 67.66, got ${receipt.summary.min}`);
    assert.equal(receipt.summary.min_pass, false);
    assert.equal(receipt.summary.mean_pass, false);
    assert.equal(receipt.chapters.length, 3);
    for (const ch of receipt.chapters) assert.equal(ch.pass, false, `${ch.unit} is sub-bar`);
    // Sealed: the binding validates, and each unit carries its custody hashes.
    assert.equal(receipt.custody.length, 3);
    for (const c of receipt.custody) assert.match(c.adjudicationCanonicalSha256, /^[0-9a-f]{64}$/);
    // The gate rejects this minted receipt (bound to matching content).
    const current: D7CurrentContent = new Map(receipt.chapters.map((ch) => [ch.unit, {
      chapterNumber: ch.chapterNumber,
      contentDocSha256: ch.contentDocSha256,
      headingInventorySha256: ch.headingInventorySha256,
    }]));
    const gate = evaluateD7ShipGate({
      bookId: receipt.book_id, candidatePackageBytes: "x", shippedPackageBytes: null,
      receipt, currentContent: current, require: true,
    });
    assert.equal(gate.decision, "block");
    assert.ok(gate.halt);
  } finally {
    roots.dispose();
  }
});

test("buildD7ShipGateReceiptCore carries the exact bar verdict from buildRubricAuditReport (sealed baseline)", () => {
  const auditId = "zz-report-check";
  const manifest = {
    schema: "rubric-audit-batch-v1",
    auditId,
    rubricVersion: "2.0",
    bar: RUBRIC_AUDIT_BAR_D7,
    calibration: { unit: "made-to-stick-ch04", expectedChapterDiagnostic: 67.66447368421052 },
    chapters: SEALED_UNITS.map((u, i) => ({ unit: u.unit, chapterNumber: i + 1 })),
  } as unknown as RubricAuditBatchManifestV1;
  const adjudications = new Map(SEALED_UNITS.map((u) => [
    u.unit,
    JSON.parse(readFileSync(resolve(OWNER_RUN, `raw/adjudicated/${u.unit}.json`), "utf8")) as Record<string, unknown>,
  ]));
  const calibrationAdjudication = JSON.parse(
    readFileSync(resolve(OWNER_RUN, "raw/adjudicated/made-to-stick-ch04.json"), "utf8")) as Record<string, unknown>;
  const report = buildRubricAuditReport({ manifest, adjudications, calibrationAdjudication });
  assert.equal(report.summary.verdict, "FAIL");

  const contentBindings = new Map(SEALED_UNITS.map((u, i) => [u.unit, {
    chapterNumber: i + 1,
    contentDocSha256: "0".repeat(64),
    headingInventorySha256: "0".repeat(64),
  }]));
  const core = buildD7ShipGateReceiptCore({ bookId: "zz-x", auditId, round: 1, report, contentBindings, custody: [] });
  assert.equal(core.verdict, "FAIL");
  assert.equal(core.book_cds, report.summary.mean);
  assert.ok(core.chapters.every((c) => c.pass === false));
});

// ── Structural: the gate makes zero model/codex calls ─────────────────────────

test("the D7 ship-gate module imports no model/codex runner (structurally model-free)", () => {
  const src = readFileSync(resolve(PIPELINE_DIR, "src/critics/d7ShipGate.ts"), "utf8");
  for (const line of src.split("\n").filter((l) => /^\s*import\b/.test(l))) {
    assert.doesNotMatch(line, /codex|runVerb|spawn|modelRunner|liveRun|providerRouter/i, `unexpected runtime dependency: ${line.trim()}`);
  }
  assert.doesNotMatch(src, /process\.env/, "the gate reads no ambient environment (require is a parameter)");
});
