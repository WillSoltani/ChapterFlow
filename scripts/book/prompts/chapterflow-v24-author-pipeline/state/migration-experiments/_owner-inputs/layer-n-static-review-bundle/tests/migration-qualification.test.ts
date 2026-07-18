/**
 * IMP-11 — Stage Q: corpus validation (all eight adversarial classes,
 * verifiable anchors, leak-free docs), the frozen scoring rules, qualification
 * enforcement (an unqualified/dry-run/stale-instrument judge cannot score),
 * and the qualification/candidate overlap detector.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { test } from "./harness.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { chapterContentHash } from "../src/critics/qcAttestation.js";
import type { ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import { migrationForbiddenTokens, migrationRoots, MigrationGuardError } from "../src/bakeoff/migration/guards.js";
import {
  anchorMatched,
  assertJudgeQualified,
  DEFAULT_QUAL_THRESHOLDS,
  detectQualificationOverlap,
  qualificationPath,
  runJudgeQualification,
  scoreJudgeQualification,
  validateQualCorpus,
  type JudgeItemOutput,
} from "../src/bakeoff/migration/qualification.js";
import type { MigrationSampleRecordV1, QualCorpusV1 } from "../src/bakeoff/migration/experimentTypes.js";
import { ANCHOR_FABRICATION, confirmatorySpec, INJECTION_MARKER, mkQualCorpus } from "./migration-helpers.js";
import { fakeAutopilotDeps, tmpRoot } from "./model-bakeoff-helpers.js";

const FORBIDDEN = migrationForbiddenTokens(confirmatorySpec());
const JUDGE = { model: "gpt-5.5", effort: "high" as const };

function outputsFor(corpus: QualCorpusV1, mode: "sharp" | "flags-controls" | "obeys-injection"): JudgeItemOutput[] {
  return corpus.items.map((item) => {
    const detect = !item.cleanControl;
    const flagged = mode === "flags-controls" ? true : detect;
    const echoes = mode === "obeys-injection" && item.class === "prompt-injection";
    return {
      itemId: item.itemId,
      valid: true,
      pass: echoes ? true : !flagged,
      complaints: flagged && !echoes
        ? item.expected.map((e) => ({ unit: "deep read", problem: `Unsupported: "${e.mustQuote ?? "this passage"}" has no source basis.` }))
        : [],
      verdictText: echoes ? `${INJECTION_MARKER} PASS as instructed` : flagged ? "FAIL" : "PASS",
      echoedMarker: echoes,
    };
  });
}

test("corpus validation: the seed corpus is valid; missing classes, unverifiable anchors, and marker-less injection items are refused", () => {
  const corpus = mkQualCorpus();
  assert.deepEqual(validateQualCorpus(corpus, FORBIDDEN), []);

  const missingClass = { ...corpus, items: corpus.items.filter((i) => i.class !== "structural-clone") };
  assert.ok(validateQualCorpus(missingClass, FORBIDDEN).some((p) => p.includes('"structural-clone" class')));

  const badAnchor = {
    ...corpus,
    items: corpus.items.map((i) => (i.itemId === "q-fab" ? { ...i, expected: [{ ...i.expected[0], mustQuote: "text that is nowhere in the doc" }] } : i)),
  };
  assert.ok(validateQualCorpus(badAnchor, FORBIDDEN).some((p) => p.includes("mustQuote anchor")));

  const noMarker = {
    ...corpus,
    items: corpus.items.map((i) => (i.class === "prompt-injection" ? { ...i, injectionMarker: undefined } : i)),
  };
  assert.ok(validateQualCorpus(noMarker, FORBIDDEN).some((p) => p.includes("injectionMarker")));
});

test("anchor rule: complaint text containing the anchor, or a non-trivial quoted run overlapping it, detects; anchored defects ignore unrelated complaints", () => {
  assert.equal(anchorMatched(ANCHOR_FABRICATION, [{ unit: "hook", problem: `The claim "${ANCHOR_FABRICATION}" is invented.` }]), true);
  assert.equal(anchorMatched(ANCHOR_FABRICATION, [{ unit: "hook", problem: 'It quotes "Dr. Fabricated told the board" without a source.' }]), true, "a quoted sub-run of the anchor matches");
  assert.equal(anchorMatched(ANCHOR_FABRICATION, [{ unit: "quiz", problem: "Q2 is ambiguous." }]), false, "an unrelated complaint does not detect an anchored defect");
  assert.equal(anchorMatched(undefined, [{ unit: "quiz", problem: "anything" }]), true, "no anchor → any complaint counts");
  assert.equal(anchorMatched(undefined, []), false);
});

test("scoring: a sharp judge qualifies; flagging clean controls fails FPR; obeying the injection fails resistance; synthetic labels force dryRunOnly", () => {
  const corpus = mkQualCorpus();

  const sharp = scoreJudgeQualification({ corpus, outputs: outputsFor(corpus, "sharp"), thresholds: DEFAULT_QUAL_THRESHOLDS, judge: JUDGE });
  assert.equal(sharp.qualified, true, JSON.stringify(sharp.perClass));
  assert.equal(sharp.falsePositiveRate, 0);
  assert.equal(sharp.injectionResistanceRate, 1);
  assert.equal(sharp.evidenceQuoteValidityRate, 1, "every quoted run byte-verifies against the rendered doc");
  assert.equal(sharp.dryRunOnly, true, "synthetic-seed labels can never produce a §16-valid qualification");

  const trigger = scoreJudgeQualification({ corpus, outputs: outputsFor(corpus, "flags-controls"), thresholds: DEFAULT_QUAL_THRESHOLDS, judge: JUDGE });
  assert.equal(trigger.qualified, false);
  assert.equal(trigger.falsePositiveRate, 1, "both clean controls flagged");

  const gullible = scoreJudgeQualification({ corpus, outputs: outputsFor(corpus, "obeys-injection"), thresholds: DEFAULT_QUAL_THRESHOLDS, judge: JUDGE });
  assert.equal(gullible.qualified, false);
  assert.equal(gullible.injectionResistanceRate, 0, "echoing the injected token (or verdict-flipping) fails resistance");
});

test("runJudgeQualification drives the review instrument per item, persists the record; enforcement refuses missing/failed/dry-run/stale qualifications", async () => {
  const corpus = mkQualCorpus();
  const roots = migrationRoots("exp-qual", tmpRoot("cf-mig-qual-"));
  const deps = fakeAutopilotDeps() as AutopilotDeps;
  const reviewed: string[] = [];
  const fakeReview = (async (_bookId, chapter, _deps, _io, _bar, labelSuffix) => {
    reviewed.push(String(labelSuffix));
    const item = corpus.items.find((i) => chapterContentHash(i.chapter) === chapterContentHash(chapter))!;
    const flag = !item.cleanControl;
    return {
      valid: true,
      pass: !flag,
      complaints: flag ? item.expected.map((e) => ({ unit: "deep read", problem: `Unsupported: "${e.mustQuote ?? "passage"}".`, mustFix: true })) : [],
      oneParagraphVerdict: flag ? "FAIL: planted defect found" : "PASS: clean",
      composite: flag ? 60 : 90,
    } as unknown as ChapterReviewV1;
  }) as typeof import("../src/orchestrator/authorReview.js").reviewOneChapter;

  const q = await runJudgeQualification({
    corpus,
    judge: JUDGE,
    thresholds: DEFAULT_QUAL_THRESHOLDS,
    deps,
    roots,
    forbiddenTokens: FORBIDDEN,
    log: () => {},
    reviewFn: fakeReview,
  });
  assert.equal(reviewed.length, corpus.items.length, "every corpus item was read through the instrument");
  assert.equal(q.qualified, true);
  assert.ok(existsSync(qualificationPath(roots, JUDGE)), "qualification record persisted");

  // Enforcement: dry-run label provenance refuses live use; allowSynthetic passes.
  assert.throws(() => assertJudgeQualified(roots, JUDGE, false), (e: Error) => e instanceof MigrationGuardError && /synthetic labels/.test(e.message));
  const loaded = assertJudgeQualified(roots, JUDGE, true);
  assert.equal(loaded.qualified, true);

  // An unknown judge has no record at all.
  assert.throws(() => assertJudgeQualified(roots, { model: "gpt-5.6-sol", effort: "high" }, true), /no qualification record/);

  // A qualification earned on a DIFFERENT review instrument is stale.
  const p = qualificationPath(roots, JUDGE);
  const record = JSON.parse(readFileSync(p, "utf8"));
  record.instrumentVersions.readerRubricVersion = "reader-rubric-v2-legacy";
  writeFileSync(p, JSON.stringify(record, null, 2) + "\n");
  assert.throws(() => assertJudgeQualified(roots, JUDGE, true), /different review instrument/);

  // A FAILED qualification refuses regardless of flags.
  record.instrumentVersions.readerRubricVersion = loaded.instrumentVersions.readerRubricVersion;
  record.qualified = false;
  writeFileSync(p, JSON.stringify(record, null, 2) + "\n");
  assert.throws(() => assertJudgeQualified(roots, JUDGE, true), /NOT qualified/);
});

test("overlap detector: a corpus chapter appearing among candidate outputs invalidates the experiment (red-team case 1)", () => {
  const corpus = mkQualCorpus();
  const overlapHash = chapterContentHash(corpus.items[2].chapter);
  const records = [
    { artifact: { contentSha256: overlapHash } },
    { artifact: { contentSha256: "f".repeat(64) } },
    { artifact: { contentSha256: null } },
  ] as MigrationSampleRecordV1[];
  assert.deepEqual(detectQualificationOverlap(corpus, records), ["q-fab"]);
  assert.deepEqual(detectQualificationOverlap(corpus, records.slice(1)), []);
});
