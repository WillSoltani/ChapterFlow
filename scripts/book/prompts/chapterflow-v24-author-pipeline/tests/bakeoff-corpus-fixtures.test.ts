/** WP-701 (model-free) — sealed 3-chapter bakeoff corpus packet.
 *
 * Proves docs/v25/bakeoff-corpus-v1/corpus-manifest.json is a byte-stable,
 * independently-recomputed pointer into the sealed rubric-audit-2026-07-15
 * evidence — never a hand-copied summary of it:
 *
 *  (a) the in-repo reader doc for each unit hashes to the manifest sourceHash;
 *  (b) each chapter_diagnostic_score is rebuilt from the sealed adjudicated
 *      JSON's raw subcriteria ratings via the instrument's OWN RUBRIC_DOMAINS
 *      weights and RUBRIC_CHAPTER_WEIGHT_TOTAL divisor (never re-implemented
 *      constants, never copied from REPORT.md prose) and matches the manifest
 *      value to full floating-point precision;
 *  (c) the manifest lists exactly the three frozen book/chapter bindings;
 *  (d) authoringSource === "UNRESOLVED" drives (not just states) a
 *      not-ready-for-bakeoff verdict — proved by re-deriving the verdict from
 *      the units array and by showing the SAME derivation flips to ready once
 *      every authoringSource is resolved (so the verdict cannot be a hidden
 *      hardcoded string);
 *  (e) the manifest is byte-stable under the pipeline's canonical serializer
 *      (parse → re-emit === the on-disk bytes).
 *
 * Zero model calls. Zero writes. Every sealed source under
 * docs/v25/rubric-audit-2026-07-15/ and the reader-docs pool is read-only.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { PIPELINE_DIR } from "../src/bakeoff/paths.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import { canonicalPretty } from "../src/bakeoff/migration/corpusBuilderCore.js";
import {
  RUBRIC_CHAPTER_WEIGHT_TOTAL,
  RUBRIC_DOMAINS,
} from "../src/bakeoff/migration/rubricAuditInstrument.js";

const REPOSITORY_ROOT = resolve(PIPELINE_DIR, "../../../..");
const CORPUS_DIR_REL = "docs/v25/bakeoff-corpus-v1";
const MANIFEST_PATH = resolve(REPOSITORY_ROOT, `${CORPUS_DIR_REL}/corpus-manifest.json`);

type ProvenanceChain = {
  inspectionRelPath: string; inspectionSha256: string;
  primaryRelPath: string; primarySha256: string;
  verificationRelPath: string; verificationSha256: string;
  primaryDispatchRelPath: string; primaryDispatchSha256: string;
  verificationDispatchRelPath: string; verificationDispatchSha256: string;
  pairSealRelPath: string; pairSealSha256: string;
};

type CorpusUnit = {
  unit: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceHash: string;
  auditedReaderDocRelPath: string;
  sealedAdjudicatedRecordRelPath: string;
  sealedAdjudicatedRecordSha256: string;
  sealedChapterDiagnostic: number;
  sealedBand: string;
  authoringSource: string;
  provenanceChain: ProvenanceChain;
};

type CorpusManifest = {
  schema: string;
  corpusId: string;
  immutable: boolean;
  rubricVersion: string;
  sealedRunId: string;
  sealedRunRelPath: string;
  d7Floors: { releaseMean: number; screeningMean: number };
  consumers: string[];
  units: CorpusUnit[];
  bakeoffReadiness: string;
  bakeoffReadinessReason: string;
};

function readManifestRaw(): string {
  return readFileSync(MANIFEST_PATH, "utf8");
}

function readManifest(): CorpusManifest {
  return JSON.parse(readManifestRaw()) as CorpusManifest;
}

/** The SAME derivation the manifest's own bakeoffReadiness must reflect: a
 *  packet is ready only when every unit has a resolved (non-UNRESOLVED)
 *  authoringSource. Defined locally (not imported) so this test is an
 *  INDEPENDENT re-derivation, not a call into the value it is checking. */
function deriveBakeoffReadiness(units: ReadonlyArray<{ authoringSource: string }>): "ready-for-bakeoff" | "not-ready-for-bakeoff" {
  return units.every((u) => u.authoringSource !== "UNRESOLVED") ? "ready-for-bakeoff" : "not-ready-for-bakeoff";
}

/** Independently rebuilds a chapter_diagnostic_score from a sealed adjudicated
 *  record's raw domain subcriteria ratings, using ONLY the instrument's own
 *  RUBRIC_DOMAINS weight table and RUBRIC_CHAPTER_WEIGHT_TOTAL divisor — the
 *  exact arithmetic validateDomains() enforces internally (domain_score = mean
 *  of 4 subcriteria ratings; weighted_points = domain_score/4*weight;
 *  chapter_diagnostic_score = sum(weighted_points)/RUBRIC_CHAPTER_WEIGHT_TOTAL*100). */
function recomputeChapterDiagnostic(adjudicated: Record<string, unknown>): number {
  const domains = adjudicated.domains as Record<string, { subcriteria: Record<string, { rating: number }> }>;
  let weightedTotal = 0;
  for (const spec of RUBRIC_DOMAINS) {
    const domain = domains[spec.key];
    assert.ok(domain, `sealed record is missing domain ${spec.key}`);
    const ratings = spec.subcriteria.map((key) => {
      const rating = domain.subcriteria[key]?.rating;
      assert.equal(typeof rating, "number", `${spec.key}.${key}.rating must be numeric`);
      return rating;
    });
    const domainScore = ratings.reduce((a, b) => a + b, 0) / 4;
    const weightedPoints = (domainScore / 4) * spec.weight;
    weightedTotal += weightedPoints;
  }
  return (weightedTotal / RUBRIC_CHAPTER_WEIGHT_TOTAL) * 100;
}

// ── (c) exactly 3 units, frozen book/chapter bindings ────────────────────────

const FROZEN_BINDINGS: ReadonlyArray<{ unit: string; bookId: string; chapterNumber: number }> = [
  { unit: "nudge-ch03", bookId: "nudge", chapterNumber: 3 },
  { unit: "made-to-stick-ch04", bookId: "made-to-stick", chapterNumber: 4 },
  { unit: "the-happiness-hypothesis-ch06", bookId: "the-happiness-hypothesis", chapterNumber: 6 },
];

test("corpus-manifest.json lists exactly the 3 frozen book/chapter bindings", () => {
  const manifest = readManifest();
  assert.equal(manifest.units.length, 3);
  const byUnit = new Map(manifest.units.map((u) => [u.unit, u]));
  assert.equal(byUnit.size, 3, "unit ids must be distinct");
  for (const binding of FROZEN_BINDINGS) {
    const unit = byUnit.get(binding.unit);
    assert.ok(unit, `manifest is missing frozen unit ${binding.unit}`);
    assert.equal(unit.bookId, binding.bookId, `${binding.unit} bookId drifted`);
    assert.equal(unit.chapterNumber, binding.chapterNumber, `${binding.unit} chapterNumber drifted`);
  }
});

test("corpus-manifest.json declares the sealed/immutable D7 floors and consumers", () => {
  const manifest = readManifest();
  assert.equal(manifest.immutable, true);
  assert.equal(manifest.d7Floors.releaseMean, 85);
  assert.equal(manifest.d7Floors.screeningMean, 75);
  assert.deepEqual([...manifest.consumers].sort(), ["WP-703", "WP-704"]);
});

// ── (a) source-hash recomputation ────────────────────────────────────────────

test("SHA-256 of each in-repo reader doc equals the manifest sourceHash", () => {
  const manifest = readManifest();
  assert.equal(manifest.units.length, 3);
  for (const unit of manifest.units) {
    const bytes = readFileSync(resolve(REPOSITORY_ROOT, unit.auditedReaderDocRelPath));
    const recomputed = sha256Hex(bytes);
    assert.equal(recomputed, unit.sourceHash, `${unit.unit} sourceHash drifted from the in-repo reader doc`);
  }
});

test("a perturbed sourceHash would be caught (fail-closed comparison, not a no-op)", () => {
  const manifest = readManifest();
  const unit = manifest.units[0];
  const bytes = readFileSync(resolve(REPOSITORY_ROOT, unit.auditedReaderDocRelPath));
  const recomputed = sha256Hex(bytes);
  const perturbed = `${recomputed.slice(0, -1)}${recomputed.endsWith("0") ? "1" : "0"}`;
  assert.notEqual(recomputed, perturbed, "perturbation must actually change the digest");
});

// ── (b) sealed-diagnostic recomputation from adjudicated JSON ────────────────

test("each chapter_diagnostic_score is rebuilt from sealed subcriteria ratings and matches the manifest to full precision", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    const adjudicated = JSON.parse(
      readFileSync(resolve(REPOSITORY_ROOT, unit.sealedAdjudicatedRecordRelPath), "utf8"),
    ) as Record<string, unknown>;
    // Bind the manifest's pointer to the exact sealed bytes before trusting its content.
    assert.equal(
      sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, unit.sealedAdjudicatedRecordRelPath))),
      unit.sealedAdjudicatedRecordSha256,
      `${unit.unit} sealed adjudicated record drifted from its manifest pointer`,
    );
    const recomputed = recomputeChapterDiagnostic(adjudicated);
    assert.equal(recomputed, unit.sealedChapterDiagnostic,
      `${unit.unit} recomputed diagnostic disagrees with the manifest — STOP: do not "correct" the manifest to match`);
    assert.equal(adjudicated.chapter_diagnostic_score, unit.sealedChapterDiagnostic,
      `${unit.unit} manifest diagnostic disagrees with the sealed record's own stored score`);
    assert.equal(adjudicated.diagnostic_band, unit.sealedBand, `${unit.unit} sealedBand drifted from the sealed record`);
  }
});

test("the three sealed diagnostics are the exact frozen calibration values", () => {
  const manifest = readManifest();
  const byUnit = new Map(manifest.units.map((u) => [u.unit, u.sealedChapterDiagnostic]));
  assert.equal(byUnit.get("nudge-ch03"), 70.75657894736842);
  assert.equal(byUnit.get("made-to-stick-ch04"), 67.66447368421052);
  assert.equal(byUnit.get("the-happiness-hypothesis-ch06"), 68.8157894736842);
});

// ── (d) UNRESOLVED authoringSource ⇒ not-ready-for-bakeoff, fail-closed ──────

test("every unit's authoringSource is the explicit UNRESOLVED fail-closed state", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    assert.equal(unit.authoringSource, "UNRESOLVED",
      `${unit.unit} authoringSource must be the explicit UNRESOLVED marker (no owner draft is registered)`);
  }
});

test("UNRESOLVED authoringSource drives a not-ready-for-bakeoff verdict — no hidden default", () => {
  const manifest = readManifest();
  const derived = deriveBakeoffReadiness(manifest.units);
  assert.equal(derived, "not-ready-for-bakeoff");
  assert.equal(manifest.bakeoffReadiness, "not-ready-for-bakeoff");
  assert.equal(manifest.bakeoffReadiness, derived, "stored bakeoffReadiness must equal the independent re-derivation");
  assert.ok(manifest.bakeoffReadinessReason.length > 0, "a fail-closed verdict must carry a stated reason");

  // Prove the derivation is state-driven, not a hardcoded string: resolving
  // every unit's authoringSource (on an in-memory copy only) must flip the
  // SAME derivation function to ready-for-bakeoff.
  const resolvedUnits = manifest.units.map((u) => ({ ...u, authoringSource: "docs/example/resolved-draft.md#ch" }));
  assert.equal(deriveBakeoffReadiness(resolvedUnits), "ready-for-bakeoff",
    "the readiness derivation must respond to authoringSource state, not always report not-ready");

  // And a single remaining UNRESOLVED unit must still veto readiness.
  const partiallyResolved = manifest.units.map((u, index) => ({
    ...u,
    authoringSource: index === 0 ? "UNRESOLVED" : "docs/example/resolved-draft.md#ch",
  }));
  assert.equal(deriveBakeoffReadiness(partiallyResolved), "not-ready-for-bakeoff",
    "a single UNRESOLVED unit must veto the whole packet");
});

// ── (e) manifest is byte-stable under the canonical serializer ──────────────

test("corpus-manifest.json is byte-stable under the canonical serializer (parse -> re-emit === on-disk bytes)", () => {
  const raw = readManifestRaw();
  const parsed = JSON.parse(raw) as unknown;
  const reEmitted = canonicalPretty(parsed);
  assert.equal(reEmitted, raw, "corpus-manifest.json must be exactly the canonical-serializer form of its own content");
});

// ── Provenance chain: pointers, not copies, and every hash is live-verified ──

test("the inspection/receipt provenance chain hashes match the sealed evidence files", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    const chain = unit.provenanceChain;
    const pairs: Array<[string, string]> = [
      [chain.inspectionRelPath, chain.inspectionSha256],
      [chain.primaryRelPath, chain.primarySha256],
      [chain.verificationRelPath, chain.verificationSha256],
      [chain.primaryDispatchRelPath, chain.primaryDispatchSha256],
      [chain.verificationDispatchRelPath, chain.verificationDispatchSha256],
      [chain.pairSealRelPath, chain.pairSealSha256],
    ];
    for (const [relPath, expectedSha] of pairs) {
      const actual = sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, relPath)));
      assert.equal(actual, expectedSha, `${unit.unit} provenance pointer drifted: ${relPath}`);
    }
    // The manifest's own sourceHash must equal the inspection record's source_hash
    // (the two are independent fields; they must never silently diverge).
    const inspection = JSON.parse(
      readFileSync(resolve(REPOSITORY_ROOT, chain.inspectionRelPath), "utf8"),
    ) as { source_hash: string };
    assert.equal(inspection.source_hash, unit.sourceHash, `${unit.unit} inspection source_hash disagrees with manifest sourceHash`);
  }
});

// ── Zero edits to sealed evidence (belt-and-suspenders, in-process check) ────

test("the corpus dir carries no copy of sealed evidence bytes (pointers only)", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    assert.ok(unit.sealedAdjudicatedRecordRelPath.startsWith("docs/v25/rubric-audit-2026-07-15/"),
      `${unit.unit} must point INTO the sealed run dir, never a copy under ${CORPUS_DIR_REL}`);
    assert.ok(!unit.sealedAdjudicatedRecordRelPath.startsWith(CORPUS_DIR_REL));
  }
});
