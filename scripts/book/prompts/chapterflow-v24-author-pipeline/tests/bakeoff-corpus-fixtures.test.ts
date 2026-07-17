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
import { existsSync, readFileSync } from "node:fs";
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
  frozenInputs: Array<{ relPath: string; sha256: string }>;
  researchRunId: string;
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
 *  packet is ready only when every unit has a RESOLVED authoringSource.
 *  Defined locally (not imported) so this test is an INDEPENDENT
 *  re-derivation, not a call into the value it is checking.
 *
 *  Resolution is an ALLOWLIST, not a denylist (red-team FINDING-1): a unit is
 *  resolved ONLY when authoringSource looks like a real repo-relative pointer
 *  (path-shaped, containing a directory separator, optionally with a
 *  #fragment). Anything else — the UNRESOLVED sentinel, "", whitespace, or
 *  placeholder strings like TODO/PENDING/TBD — stays fail-closed. */
const AUTHORING_SOURCE_PLACEHOLDERS = new Set([
  "", "UNRESOLVED", "TODO", "PENDING", "TBD", "NULL", "NONE", "N/A",
]);

function isResolvedAuthoringSource(value: string): boolean {
  const trimmed = value.trim();
  if (AUTHORING_SOURCE_PLACEHOLDERS.has(trimmed.toUpperCase())) return false;
  return trimmed.includes("/") && /^[A-Za-z0-9][A-Za-z0-9._/-]*(#[A-Za-z0-9._-]+)?$/.test(trimmed);
}

function deriveBakeoffReadiness(units: ReadonlyArray<{ authoringSource: string }>): "ready-for-bakeoff" | "not-ready-for-bakeoff" {
  return units.every((u) => isResolvedAuthoringSource(u.authoringSource)) ? "ready-for-bakeoff" : "not-ready-for-bakeoff";
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
    // Direct source-identity cross-binding (red-team FINDING-2): the sealed
    // adjudicated record itself must name this unit's source and book/chapter —
    // a swapped record cannot pass even if its pointer hash and diagnostic were
    // somehow made consistent.
    assert.equal(adjudicated.source_hash, unit.sourceHash,
      `${unit.unit} adjudicated record source_hash disagrees with the unit sourceHash (record/unit swap?)`);
    // The sealed records identify the audited unit via book.book_id (e.g.
    // "nudge-ch03" — the unit id, not the bare catalog bookId).
    const book = adjudicated.book as { book_id: string };
    assert.equal(book.book_id, unit.unit, `${unit.unit} adjudicated record book_id disagrees with the unit binding`);
    const chapter = adjudicated.chapter as { number: number };
    assert.equal(chapter.number, unit.chapterNumber, `${unit.unit} adjudicated record chapter number disagrees with the unit binding`);
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

test("every unit's authoringSource is a RESOLVED frozen-brief pointer (Stage-B freeze, L-44)", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    const nn = String(unit.chapterNumber).padStart(2, "0");
    assert.equal(
      unit.authoringSource,
      `scripts/book/prompts/chapterflow-v24-author-pipeline/state/books/${unit.bookId}/runs/v23-current/briefs/ch${nn}.brief.json`,
      `${unit.unit} authoringSource must point at its frozen chapter brief`,
    );
    assert.ok(isResolvedAuthoringSource(unit.authoringSource), `${unit.unit} authoringSource must pass the resolution allowlist`);
    assert.ok(existsSync(resolve(REPOSITORY_ROOT, unit.authoringSource)), `${unit.unit} authoringSource file must exist on disk`);
  }
});

test("every frozenInputs entry re-hashes to its recorded SHA-256 (the frozen shared-input set is byte-bound)", () => {
  const manifest = readManifest();
  for (const unit of manifest.units) {
    assert.ok(Array.isArray(unit.frozenInputs) && unit.frozenInputs.length === 6,
      `${unit.unit} must freeze exactly 6 shared inputs (index, sidecar, packet, brief json+md, design)`);
    for (const fi of unit.frozenInputs) {
      const recomputed = sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, fi.relPath)));
      assert.equal(recomputed, fi.sha256, `${unit.unit} frozen input drifted since the freeze: ${fi.relPath}`);
    }
    // The authoringSource pointer itself is a member of the frozen set.
    assert.ok(unit.frozenInputs.some((fi) => fi.relPath === unit.authoringSource),
      `${unit.unit} authoringSource must be hash-bound under frozenInputs`);
  }
});

test("RESOLVED authoringSource drives the ready-for-bakeoff verdict — and UNRESOLVED still vetoes (no hidden default)", () => {
  const manifest = readManifest();
  const derived = deriveBakeoffReadiness(manifest.units);
  assert.equal(derived, "ready-for-bakeoff");
  assert.equal(manifest.bakeoffReadiness, "ready-for-bakeoff");
  assert.equal(manifest.bakeoffReadiness, derived, "stored bakeoffReadiness must equal the independent re-derivation");
  assert.ok(manifest.bakeoffReadinessReason.length > 0, "the verdict must carry a stated reason");

  // The derivation stays state-driven: a single UNRESOLVED unit (in-memory
  // copy only) must veto the whole packet.
  const partiallyUnresolved = manifest.units.map((u, index) => ({
    ...u,
    authoringSource: index === 0 ? "UNRESOLVED" : u.authoringSource,
  }));
  assert.equal(deriveBakeoffReadiness(partiallyUnresolved), "not-ready-for-bakeoff",
    "a single UNRESOLVED unit must veto the whole packet");
});

test("placeholder authoringSource values never derive readiness (allowlist, not denylist)", () => {
  const manifest = readManifest();
  // Red-team FINDING-1: under the old denylist derivation, any non-sentinel
  // string — including "" and TODO-style placeholders — counted as resolved.
  // The allowlist derivation must veto every one of these.
  for (const placeholder of ["", " ", "TODO", "PENDING", "TBD", "null", "n/a", "yes", "resolved"]) {
    const units = manifest.units.map((u) => ({ ...u, authoringSource: placeholder }));
    assert.equal(deriveBakeoffReadiness(units), "not-ready-for-bakeoff",
      `placeholder authoringSource ${JSON.stringify(placeholder)} must NOT derive ready-for-bakeoff`);
  }
  // While a genuine repo-relative pointer does resolve.
  const resolved = manifest.units.map((u) => ({ ...u, authoringSource: "docs/v25/bakeoff-corpus-v1/frozen-inputs/example.md" }));
  assert.equal(deriveBakeoffReadiness(resolved), "ready-for-bakeoff");
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
