import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { STATE_CHAPTERS, makeChapter, writeFixtureBook } from "./helpers.js";
import { AXIS_WEIGHTS, computeVerdict, type AxisId, type AxisScore } from "../src/critics/semantic/publishableBar.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import { collectQcRound } from "../src/qc/orchestrator/index.js";
import { barArtifactPath, orchestratorRoundDir, submissionsDir } from "../src/qc/orchestrator/artifacts.js";
import { findingsFromEvidenceDecision } from "../src/qc/orchestrator/finalizerFindings.js";
import { appendFindings, effectiveLedger, hasBlockingAuthority, migrateRawSemanticLedgerFindings, readLedgerEvents } from "../src/qc/orchestrator/ledger.js";
import type { SubmissionFinding } from "../src/qc/orchestrator/schemas.js";

const BOOK = "zz-fixture-effective-ledger";
const ROUND = "r-effective-ledger";
const ALL_AXES = Object.keys(AXIS_WEIGHTS) as AxisId[];
const NON_KEY_AXES = ALL_AXES.filter((axis) => axis !== "quiz_key_correctness");

function cleanup(): void {
  rmSync(orchestratorRoundDir(BOOK, ROUND), { recursive: true, force: true });
  for (const n of [1, 2, 3]) rmSync(resolve(STATE_CHAPTERS, `${BOOK}-ch${String(n).padStart(2, "0")}.v21-native.chapter.json`), { force: true });
}

function rawBase(): any {
  return {
    source: { findings: [] },
    authorFindings: [],
    shipGate: { blockers: [], majors: [], minors: [] },
    intraFindings: [],
    bookGate: { findings: [] },
    keyJudge: null,
    bar: null,
    confirm: null,
    confirmAccepted: false,
    planFindings: [],
  };
}

function decision(checks: Partial<any> = {}): any {
  return {
    chapterNumber: 1,
    chapterId: `${BOOK}-ch01`,
    contentHash: "h",
    checks: {
      sourceV2: "PASS",
      shipGate: "PASS",
      authorCheck: "PASS",
      intraBook: "PASS",
      bookGate: "PASS",
      sweep: "PASS",
      manualKeyJudge: "PASS",
      barRead: "GREEN",
      confirmRead: "PUBLISHABLE",
      repairLedger: "NO_OPEN_BLOCKERS",
      majors: "PASS",
      planEnforcement: "PASS",
      ...checks,
    },
    majorStatus: { status: "PASS", chapter: [], book: [] },
  };
}

function barAxes(axisScore: Partial<Record<AxisId, Partial<AxisScore>>>): AxisScore[] {
  return NON_KEY_AXES.map((axis) => ({
    axis,
    score: axisScore[axis]?.score ?? 0.93,
    tier: axisScore[axis]?.tier ?? "PUBLISHABLE",
    hits: axisScore[axis]?.hits ?? [],
  }));
}

function writeBarSubmission(chapter: ReturnType<typeof makeChapter>, file: string, qdq: number, hit = false, variant?: "t2" | "t3"): void {
  const path = resolve(submissionsDir(BOOK, ROUND, variant ? "bar" : "bar"), file);
  mkdirSync(dirname(path), { recursive: true });
  const axes = barAxes({
    quiz_distractor_quality: {
      score: qdq,
      tier: qdq < 0.6 ? "GENERATED_DRAFT" : "PUBLISHABLE",
      hits: hit ? [{ unitId: "quiz.questions[0]", quote: chapter.quiz.questions[0].prompt, defect: "The raw primary read flags a quiz issue." }] : [],
    },
  });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "qc-bar-read-v2",
    bookId: BOOK,
    roundId: ROUND,
    role: "bar",
    reviewer: `codex-qc:bar:${file}`,
    chapterNumber: 1,
    chapterId: chapter.chapterId,
    contentHash: chapterContentHash(chapter),
    axes,
    notes: "Synthetic bar read.",
    verdict: computeVerdict(chapter.chapterId, [{ axis: "quiz_key_correctness", score: 1, tier: "PUBLISHABLE", hits: [] }, ...axes], true),
  }, null, 2) + "\n", "utf8");
  if (variant) writeFileSync(`${path}.meta.json`, JSON.stringify({ variant }, null, 2) + "\n", "utf8");
}

test("effective sweep findings intersect raw chapters with effective FAIL chapters", () => {
  const raw = {
    ...rawBase(),
    sweepRecord: {
      verdict: "REVISE",
      findings: [{
        family: "scene_skeleton",
        chapters: [1, 2, 3],
        unitId: "examples",
        quote: "same quoted scene frame across the named chapters",
        problem: "raw finding over-named one unchanged chapter",
        expectedFix: "Repair only effectively failed chapters.",
      }],
    },
    effectiveFailureChapters: { sweep: new Set([1, 3]), bookGate: new Set<number>() },
  };
  const findings = findingsFromEvidenceDecision(decision({ sweep: "FAIL" }), raw);
  assert.deepEqual(findings.map((f) => f.chapters), [[1, 3]]);
});

test("primary raw bar major plus GREEN median tiebreak creates no blocking ledger entry during collection", () => {
  try {
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    writeBarSubmission(chapter, "primary.json", 0.58, true);
    writeBarSubmission(chapter, "t2.json", 0.62, false, "t2");
    writeBarSubmission(chapter, "t3.json", 0.61, false, "t3");

    const collected = collectQcRound(BOOK, ROUND);
    assert.equal(collected.ok, true, collected.errors.join("\n"));
    assert.equal(effectiveLedger(BOOK, ROUND).filter(hasBlockingAuthority).length, 0);
    assert.ok(barArtifactPath(BOOK, ROUND, 1).endsWith("ch01.bar-read.json"));
  } finally {
    cleanup();
  }
});

test("effective YELLOW bar decision emits exactly actionable effective findings with raw provenance", () => {
  const hit = { unitId: "examples.ex01", quote: "The example stalls before the decision point.", defect: "example never resolves the mechanism." };
  const raw = {
    ...rawBase(),
    bar: {
      axes: barAxes({ example_coherence: { score: 0.57, tier: "GENERATED_DRAFT", hits: [hit] } }),
      notes: "Example coherence is below the floor.",
    },
    barSources: [{ sourceRole: "bar", submissionFile: "primary.json", sourceId: "qcs-primary" }],
  };
  const findings = findingsFromEvidenceDecision(decision({ barRead: "YELLOW" }), raw);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].repairClass, "example_coherence");
  assert.equal(findings[0].unitId, hit.unitId);
  assert.deepEqual(findings[0].provenanceSources?.map((s) => s.sourceId), ["qcs-primary"]);
});

test("migrating an old dirty raw ledger preserves evidence while removing blocking authority", () => {
  try {
    cleanup();
    const chapter = makeChapter(BOOK, 1);
    writeFixtureBook(STATE_CHAPTERS, [chapter]);
    const rawFinding: SubmissionFinding = {
      chapterNumber: 1,
      unitId: "examples[0]",
      repairClass: "scene_skeleton",
      severity: "major",
      quote: String(chapter.examples[0].scenario).slice(0, 80),
      problem: "Old raw sweep blocker.",
      expectedFix: "Do not let old raw evidence block after migration.",
    };
    appendFindings({ bookId: BOOK, roundId: ROUND, role: "sweep", submissionFile: "old-sweep.json", findings: [rawFinding] });
    assert.equal(effectiveLedger(BOOK, ROUND).filter(hasBlockingAuthority).length, 0, "raw semantic entries are non-authoritative even before migration");
    const migrated = migrateRawSemanticLedgerFindings(BOOK, ROUND);
    assert.equal(migrated, 1);
    const events = readLedgerEvents(BOOK, ROUND);
    assert.ok(events.some((e) => e.event === "finding"), "raw finding event remains for audit");
    assert.ok(events.some((e) => e.event === "status" && e.status === "dismissed_non_gating"), "migration appends explicit non-gating status");
    const [finding] = effectiveLedger(BOOK, ROUND);
    assert.equal(finding.status, "dismissed_non_gating");
    assert.equal(hasBlockingAuthority(finding), false);
  } finally {
    cleanup();
  }
});
