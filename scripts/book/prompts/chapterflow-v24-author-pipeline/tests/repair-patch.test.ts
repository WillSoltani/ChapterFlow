/**
 * IMP-07 — typed transactional repair: allowlists, routes, apply, drift proof.
 *
 * Pins the master-plan §Tests list at the module level (the lane integration —
 * fake spawn dropping patch.json, whole-chapter output rejected, canonical
 * untouched — lives in tests/source-use-plan.test.ts):
 *  - per-route path allowlists, with identity/source-metadata/planSpec paths
 *    unpatchable on EVERY route;
 *  - deterministic route classification incl. escalation on causal/thesis/
 *    architecture must-fixes, out-of-surface scopes, plan-change requests, and
 *    invalid findings (control-plane fields);
 *  - apply verification: stale base, plan-hash mismatch, wrong old-value hash,
 *    out-of-scope path, duplicate/overlapping ops, out-of-bounds index
 *    (append=insert), type change, prototype pollution, per-op and whole-patch
 *    no-ops, operation-count ceiling, foreign finding ids;
 *  - successful isolated (surgical) and linked-section patches with the
 *    non-scope byte-hash proof, and detection when a non-scope field drifts;
 *  - concurrency: two patches from the same base — the second is stale after
 *    the first commits (base-hash pin, never rebase);
 *  - dependency-closure names cover the touched surface.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { fxChapter, fxRepairFinding } from "./migrationFixtures.js";
import {
  applyChapterPatch,
  classifyRepairRoute,
  dependencyClosureChecks,
  enumeratePatchablePaths,
  findingsFromComplaints,
  LEGACY_NO_PLAN_HASH,
  MAX_PATCH_OPERATIONS,
  nonScopeDrift,
  pathAllowed,
  patchValueHash,
  parsePatchPath,
} from "../src/orchestrator/repairPatch.js";
import { validateChapterPatch, type ChapterPatchV1 } from "../src/contracts/repairContracts.js";
import { sha256Hex } from "../src/contracts/contractUtil.js";
import type { ChapterV21 } from "../src/types.js";

// ── fixtures ──────────────────────────────────────────────────────────────────

function chapter(): ChapterV21 {
  return fxChapter({
    hook: "The count was wrong for a month and nobody said so.",
    counterintuition: "Silence is a decision.",
    keyTakeaway: "Name the blocker before you promise the date.",
    breakdown: { fastRead: "Fast read text.", deepRead: "Deep read text.", fullRead: "Full read text." },
    examples: [{
      exampleId: "ex-01", title: "Dock count", tags: ["ops"],
      planSpec: { domain: "ops", audience: "pros", stakes: "medium", format: "narrative", requiredBeat: "resolution" },
      scenario: "A shift lead inherits a stalled changeover.",
      whatToDo: "Map the one call that moves the date.",
      whyItMatters: "It shows the move under constraint.",
    }],
    quiz: {
      passingScorePercent: 70,
      questions: [{
        questionId: "q-01", prompt: "What is the move?",
        choices: ["Skip it", "Run the audit first", "Escalate"],
        correctIndex: 1, explanation: "The audit surfaces the blocker early.",
        bloomsLevel: "apply", depthLevel: "standard",
      }],
    },
    memorableLines: [{ text: "A promise is a debt with a date.", location: "hook", why: "compresses it" }],
    reviewCards: [{ cardId: "c-01", front: "Front?", back: "Back.", difficulty: "medium" }],
    implementationPlan: {
      title: "Name the blocker", coreSkill: "Name the single blocking dependency first.",
      ifThenPlans: [{ context: "When a date slips", plan: "If the date slips, then name the blocker aloud." }],
      twentyFourHourChallenge: "Before your next handoff, write the blocker down.",
      weeklyPractice: "Audit one artifact for unowned promises.",
    },
  } as Partial<ChapterV21>);
}

function bytesOf(ch: ChapterV21): string {
  return JSON.stringify(ch, null, 2) + "\n";
}

function mkPatch(base: ChapterV21, operations: ChapterPatchV1["operations"], over: Partial<ChapterPatchV1> = {}): ChapterPatchV1 {
  return {
    schema: "chapter-patch-v1",
    chapterId: base.chapterId,
    expectedBaseHash: sha256Hex(bytesOf(base)),
    sourcePlanHash: LEGACY_NO_PLAN_HASH,
    findingIds: ["review.must-fix#0"],
    operations,
    ...over,
  };
}

function op(path: string, current: unknown, replacement: unknown): ChapterPatchV1["operations"][number] {
  return { path, expectedOldValueHash: patchValueHash(current).slice(0, 16), replacement, dependencyUnitIds: [] };
}

const ISSUED = ["review.must-fix#0", "review.must-fix#1"];

function apply(base: ChapterV21, patch: ChapterPatchV1, route: "surgical" | "section" = "surgical") {
  return applyChapterPatch({ originalBytes: bytesOf(base), original: base, patch, route, plan: null, issuedFindingIds: ISSUED });
}

// ── allowlists ────────────────────────────────────────────────────────────────

test("IMP-07 allowlist: surgical hosts content leaves; section adds prose tiers; identity/source-metadata paths exist on NO route", () => {
  assert.ok(pathAllowed("quiz.questions[0].explanation", "surgical"));
  assert.ok(pathAllowed("quiz.questions[0].choices[2]", "surgical"));
  assert.ok(pathAllowed("examples[0].scenario", "surgical"));
  assert.ok(pathAllowed("implementationPlan.ifThenPlans[0].plan", "surgical"));
  assert.ok(!pathAllowed("breakdown.fastRead", "surgical"), "prose tiers are NOT surgical");
  assert.ok(pathAllowed("breakdown.fastRead", "section"));
  assert.ok(pathAllowed("hook", "section"));
  for (const never of [
    "chapterId", "number", "schemaVersion", "title",
    "quiz.questions[0].questionId", "quiz.questions[0].bloomsLevel", "quiz.passingScorePercent",
    "examples[0].exampleId", "examples[0].planSpec.domain", "examples[0].tags[0]",
    "examples[0].sourceAnchorId", "quiz.questions[0].sourceAnchorIds[0]",
    "reviewCards[0].cardId", "reviewCards[0].difficulty", "authoring", "experiencePlan",
  ]) {
    assert.ok(!pathAllowed(never, "surgical") && !pathAllowed(never, "section"), `must never be patchable: ${never}`);
  }
});

test("IMP-07 op menu: enumeratePatchablePaths yields scope-filtered allowlisted leaves with copyable hash prefixes", () => {
  const base = chapter();
  const quizMenu = enumeratePatchablePaths(base, "surgical", ["quiz"]);
  assert.ok(quizMenu.some((m) => m.path === "quiz.questions[0].explanation"));
  assert.ok(quizMenu.some((m) => m.path === "quiz.questions[0].correctIndex"), "number leaves included");
  assert.ok(quizMenu.every((m) => m.path.startsWith("quiz.")), "scope-filtered");
  assert.ok(quizMenu.every((m) => /^[0-9a-f]{16}$/.test(m.valueHashPrefix)), "16-hex prefixes");
  const practiceMenu = enumeratePatchablePaths(base, "surgical", ["practice"]);
  assert.ok(practiceMenu.some((m) => m.path === "tryThisNow" || m.path.startsWith("implementationPlan.")), "practice maps to the implementation surface");
  assert.ok(!quizMenu.some((m) => m.path.includes("questionId")), "identity fields never enumerated");
});

// ── routes ────────────────────────────────────────────────────────────────────

test("IMP-07 routes: deterministic lattice — leaf→surgical, prose→section, out-of-surface/causal→regeneration, plan-change→upstream, none→restore", () => {
  const surgical = findingsFromComplaints(["quiz Q2 echoes the prose"], ["quiz"]);
  assert.equal(classifyRepairRoute(surgical).route, "surgical");

  const section = [fxRepairFinding({ findingId: "f-hook", permittedRepairScope: ["hook"], recommendedRoute: "section" })];
  assert.equal(classifyRepairRoute(section).route, "section");

  const mixed = [...surgical, ...section];
  assert.equal(classifyRepairRoute(mixed).route, "section", "mixed scopes take the most-escalated patchable tier");

  const outOfSurface = [fxRepairFinding({ findingId: "f-title", permittedRepairScope: ["title"] })];
  assert.equal(classifyRepairRoute(outOfSurface).route, "regeneration", "unpatchable scope escalates");

  const causal = [fxRepairFinding({ findingId: "f-causal", category: "register.causal-overreach", severity: "must_fix", permittedRepairScope: ["breakdown"] })];
  assert.equal(classifyRepairRoute(causal).route, "regeneration", "must-fix causal territory escalates, never patches");

  const upstream = [fxRepairFinding({ findingId: "f-plan", category: "source-plan.reclassify", recommendedRoute: "upstream-source" })];
  assert.equal(classifyRepairRoute(upstream).route, "upstream-source");

  assert.equal(classifyRepairRoute([]).route, "restore");

  const hostile = [{ ...fxRepairFinding({}), model: "gpt-5.6-sol" } as never];
  const decision = classifyRepairRoute(hostile);
  assert.equal(decision.route, "restore", "a control-plane field invalidates the finding — refuse to route");
  assert.match(decision.reason, /control-plane|contract/);
});

// ── apply: success paths ──────────────────────────────────────────────────────

test("IMP-07 apply: a valid isolated patch lands, touches ONLY its paths, and the non-scope byte proof holds", () => {
  const base = chapter();
  const patch = mkPatch(base, [
    op("quiz.questions[0].explanation", "The audit surfaces the blocker early.", "The audit surfaces the blocking dependency before it costs a week."),
    op("keyTakeaway", "Name the blocker before you promise the date.", "Name the blocking dependency before promising any date."),
  ]);
  const r = apply(base, patch);
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  assert.deepEqual(r.touchedPaths.sort(), ["keyTakeaway", "quiz.questions[0].explanation"]);
  assert.equal(r.chapter.quiz.questions[0].explanation, "The audit surfaces the blocking dependency before it costs a week.");
  assert.equal(base.quiz.questions[0].explanation, "The audit surfaces the blocker early.", "the caller's original is never mutated");
  assert.deepEqual(nonScopeDrift(base, r.chapter, r.touchedPaths), [], "every non-scope leaf is byte-identical");
  const closure = dependencyClosureChecks(r.touchedPaths);
  assert.ok(closure.includes("quiz-key-integrity") && closure.includes("claim-strength-register") && closure.includes("gate-composite"));
});

test("IMP-07 apply: a linked-section patch (hook + fastRead) works on the section route and nowhere below it", () => {
  const base = chapter();
  const patch = mkPatch(base, [
    op("hook", base.hook, "The count was wrong for a month, and the meeting stayed polite."),
    op("breakdown.fastRead", "Fast read text.", "Fast read, rewritten around the real constraint."),
  ]);
  const surgical = apply(base, patch, "surgical");
  assert.ok(!surgical.ok && /allowlist/.test(surgical.ok ? "" : surgical.reason), "prose tiers reject on the surgical route");
  const section = apply(base, patch, "section");
  assert.ok(section.ok, JSON.stringify(section));
  if (section.ok) assert.deepEqual(nonScopeDrift(base, section.chapter, section.touchedPaths), []);
});

// ── apply: negatives ──────────────────────────────────────────────────────────

test("IMP-07 apply negatives: stale base, plan mismatch, wrong old value, foreign finding, no findings", () => {
  const base = chapter();
  const good = op("keyTakeaway", base.keyTakeaway, "Different takeaway entirely.");

  const stale = mkPatch(base, [good], { expectedBaseHash: "f".repeat(64) });
  assert.match((apply(base, stale) as { reason: string }).reason, /stale patch/);

  const planMismatch = mkPatch(base, [good], { sourcePlanHash: "a".repeat(64) });
  assert.match((apply(base, planMismatch) as { reason: string }).reason, /source-plan mismatch/);

  const wrongOld = mkPatch(base, [{ ...good, expectedOldValueHash: "0".repeat(16) }]);
  assert.match((apply(base, wrongOld) as { reason: string }).reason, /expectedOldValueHash/);

  const foreign = mkPatch(base, [good], { findingIds: ["never-issued#9"] });
  assert.match((apply(base, foreign) as { reason: string }).reason, /never issued/);

  const noFindings = mkPatch(base, [good], { findingIds: [] });
  assert.match((apply(base, noFindings) as { reason: string }).reason, /cites no findings/);
});

test("IMP-07 apply negatives: structure attacks — out-of-scope, duplicate, overlap, append, type change, proto pollution, op flood", () => {
  const base = chapter();
  const good = op("keyTakeaway", base.keyTakeaway, "Different takeaway entirely.");

  const outOfScope = mkPatch(base, [op("quiz.questions[0].questionId", "q-01", "q-99")]);
  assert.match((apply(base, outOfScope) as { reason: string }).reason, /allowlist/, "identity edit rejected");

  const dup = mkPatch(base, [good, { ...good, replacement: "Another different takeaway." }]);
  assert.match((apply(base, dup) as { reason: string }).reason, /duplicate/);

  const appendIdx = mkPatch(base, [op("quiz.questions[0].choices[3]", "x", "New fourth choice")]);
  assert.match((apply(base, appendIdx) as { reason: string }).reason, /out of bounds|append/i, "index==length is an insert in disguise");

  const typeChange = mkPatch(base, [{ ...op("quiz.questions[0].correctIndex", 1, 1), replacement: "1" as never }]);
  assert.match((apply(base, typeChange) as { reason: string }).reason, /type/);

  const proto = mkPatch(base, [op("__proto__.polluted", "x", "y")]);
  const protoResult = apply(base, proto);
  assert.ok(!protoResult.ok && /contract|prototype/.test(protoResult.ok ? "" : protoResult.reason), "frozen validator rejects pollution paths");

  const flood = mkPatch(base, Array.from({ length: MAX_PATCH_OPERATIONS + 1 }, (_, i) =>
    op(`quiz.questions[0].choices[${i % 3}]`, base.quiz.questions[0].choices[i % 3], `Choice v${i}`)));
  assert.match((apply(base, flood) as { reason: string }).reason, /ceiling|exceeds/, "regeneration disguised as patches");
});

test("IMP-07 apply negatives: per-op and whole-patch no-ops reject; whole-chapter output is not a patch", () => {
  const base = chapter();
  const noop = mkPatch(base, [op("keyTakeaway", base.keyTakeaway, base.keyTakeaway)]);
  assert.match((apply(base, noop) as { reason: string }).reason, /no-op/);
  // A chapter-shaped object fails the frozen patch contract outright.
  const chapterAsPatch = JSON.parse(bytesOf(base)) as unknown;
  assert.ok(validateChapterPatch(chapterAsPatch).length > 0, "whole chapters never satisfy chapter-patch-v1");
});

test("IMP-07 concurrency: two patches from the same base — the loser is stale after the winner commits (never rebased)", () => {
  const base = chapter();
  const p1 = mkPatch(base, [op("keyTakeaway", base.keyTakeaway, "Winner takeaway.")]);
  const p2 = mkPatch(base, [op("examples[0].whyItMatters", "It shows the move under constraint.", "Loser edit.")]);
  const r1 = apply(base, p1);
  assert.ok(r1.ok);
  if (!r1.ok) return;
  // The winner's result is now canonical; the second patch pinned the OLD base.
  const canonical = r1.chapter;
  const r2 = applyChapterPatch({ originalBytes: bytesOf(canonical), original: canonical, patch: p2, route: "surgical", plan: null, issuedFindingIds: ISSUED });
  assert.ok(!r2.ok && /stale patch/.test(r2.ok ? "" : r2.reason), "the base moved — reject, never rebase");
});

test("IMP-07 drift proof: an artificially mutated non-scope field is DETECTED (the proof is not vacuous)", () => {
  const base = chapter();
  const patch = mkPatch(base, [op("keyTakeaway", base.keyTakeaway, "Different takeaway entirely.")]);
  const r = apply(base, patch);
  assert.ok(r.ok);
  if (!r.ok) return;
  const sabotaged = structuredClone(r.chapter);
  sabotaged.hook = "A silently drifted hook.";
  const drifted = nonScopeDrift(base, sabotaged, r.touchedPaths);
  assert.deepEqual(drifted, ["hook"], "the proof names exactly the drifted leaf");
});

test("IMP-07 parsing: hostile and malformed paths never resolve", () => {
  for (const bad of ["", "a..b", "a.[0]", "a[b]", "quiz.questions[-1].prompt", "a".repeat(300), "0leading", "sp ace"]) {
    assert.equal(parsePatchPath(bad), null, `must not parse: "${bad}"`);
  }
  assert.deepEqual(parsePatchPath("quiz.questions[3].choices[0]"), [
    { key: "quiz", index: null }, { key: "questions", index: 3 }, { key: "choices", index: 0 },
  ]);
});

test("IMP-07 findings bridge: complaints become frozen findings with prose as evidence and plan fields pinned non-relabelable", () => {
  const findings = findingsFromComplaints(["quiz Q2: the key echoes the prose"], ["quiz"]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].schema, "repair-finding-v1");
  assert.deepEqual(findings[0].evidenceQuotes, ["quiz Q2: the key echoes the prose"]);
  assert.deepEqual(findings[0].prohibitedChanges, ["origin", "form", "claimStrength", "detailSufficiency", "framingRequired"]);
  assert.equal(classifyRepairRoute(findings).route, "surgical");
});
