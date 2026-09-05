/**
 * The two ASSEMBLY-ONLY livelocks the Franklin canary run wedged on.
 *
 * Both gates run only inside the assembly gate runner (checkSectionGate over the
 * whole book), so the draft-time gate never shows them to the writer, and BOTH
 * emitted findings with NO `signature` — which means structureAssemblyBlockers
 * dropped them, planAssemblyEvictions never saw them, nothing was evicted, and the
 * next round recompiled the identical cached packs and blocked identically. That is
 * the same permanent-wedge shape SEC83 had before Task 11ag stamped it.
 *
 *  - SEC119.cast_containment — ch16's action pack titled the reader's own plan
 *    "Put the Ask in Writing, Not in a Chase", naming "Chase" from the ch16 example
 *    pack's cast. One chapter, one pack: nothing may KEEP the leak, so the policy
 *    keeps zero chapters and evicts every implicated action pack.
 *  - SEC90.soft_banned_budget — "rather than" appeared 64 times against a
 *    per-book budget of 15, emitting one blocker per contributing field across 18
 *    chapters. Its firing condition is a BOOK TOTAL, not a chapter count, so
 *    keep-earliest-N cannot mirror it: the plan must evict the heaviest
 *    contributors until the book is back inside budget.
 *
 * Neither gate is weakened here — the budget stays 15 and both still fire exactly
 * as before; only the eviction path is added.
 */

import assert from "node:assert/strict";

import {
  CROSS_CHAPTER_EVICTION_POLICIES,
  CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS,
  planAssemblyEvictions,
} from "../../src/app/compilerApplicationPort.js";
import { structureAssemblyBlockers, type AssemblyBlocker } from "../../src/sections/assembleSections.js";
import { castContainmentFindings, checkSectionGate, usedExampleCast } from "../../src/sections/sectionGate.js";
import type {
  ActionPackV1,
  ChapterBlueprintV1,
  ExamplePackV1,
  SectionKind,
  SummaryPackV1,
} from "../../src/artifacts/artifactTypes.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const SEC119 = "SEC119.cast_containment";
const SEC90 = "SEC90.soft_banned_budget";
const BOOK = "assembly-eviction-livelock-book";

function chapterId(chapterNumber: number): string {
  return `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}`;
}

// ── SEC119 fixtures: one chapter whose example pack USES "Chase" ─────────────

function castBlueprint(chapterNumber: number): ChapterBlueprintV1 {
  return {
    chapterNumber,
    chapterId: chapterId(chapterNumber),
    reservedVariety: { allowedNames: ["Chase", "Margaret"], forbiddenNames: [] },
    sections: { examples: [{ allowedNames: ["Chase", "Margaret"] }] },
  } as unknown as ChapterBlueprintV1;
}

function castExamplePack(chapterNumber: number): ExamplePackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "example-pack",
    chapterId: chapterId(chapterNumber),
    examples: [
      {
        exampleId: "ex01",
        title: "The written ask",
        scenario: "Chase writes the request down before the meeting while Margaret waits.",
        whatToDo: "Put the request in writing.",
        whyItMatters: "Written asks are answered.",
      },
    ],
  } as unknown as ExamplePackV1;
}

function castActionPack(chapterNumber: number, title: string): ActionPackV1 {
  return {
    schemaVersion: "section-artifact-v1",
    artifactType: "action-pack",
    chapterId: chapterId(chapterNumber),
    tryThisNow: "Write one request down before you next ask for it out loud.",
    tryThisNowSourceAnchorIds: [],
    implementationPlan: {
      title,
      coreSkill: "Convert a spoken ask into a written one with a date attached.",
      ifThenPlans: [{ context: "When the ask is urgent", plan: "If it is urgent, then write it before speaking." }],
      twentyFourHourChallenge: "Write one ask down today.",
      weeklyPractice: "Audit one spoken ask each week.",
    },
  } as unknown as ActionPackV1;
}

// ---------------------------------------------------------------------------
// SEC119 — the live gate stamps an eviction signature that survives into an
// AssemblyBlocker and evicts the implicated ACTION pack.
// ---------------------------------------------------------------------------

requiredTest("SEC119 — the leaked cast name is stamped as an eviction signature and evicts that chapter's action pack", () => {
  const used = usedExampleCast(castBlueprint(16), castExamplePack(16));
  assert.ok(used.has("Chase"), "the example pack USES Chase, so it is cast");

  const findings = castContainmentFindings(
    castActionPack(16, "Put the Ask in Writing, Not in a Chase"),
    used,
    16,
  ).filter((finding) => finding.checkId === SEC119);
  assert.equal(findings.length, 1, `expected one SEC119 leak, saw ${JSON.stringify(findings.map((f) => f.message))}`);
  assert.equal(findings[0].signature, "cast:Chase", "SEC119 must stamp the leaked name as its signature");
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].section, "action-pack");
  assert.equal(findings[0].path, "/implementationPlan/title");

  const blockers = structureAssemblyBlockers(findings);
  assert.equal(blockers.length, 1, "the stamped finding must project into an AssemblyBlocker");
  assert.equal(blockers[0].phrase, "Chase");
  assert.equal(blockers[0].kind, "action-pack");

  const plan = planAssemblyEvictions(blockers, new Map([[16, chapterId(16)]]));
  assert.equal(plan.length, 1, "the leak must evict exactly the implicated action pack");
  assert.equal(plan[0].chapterNumber, 16);
  assert.equal(plan[0].kind, "action-pack");
  assert.equal(plan[0].chapterId, chapterId(16));
  assert.equal(plan[0].avoid.checkId, SEC119);
  assert.equal(plan[0].avoid.phrase, "Chase");
  // Nothing keeps a cast leak: the kept set is empty, and the wording must not
  // point the re-draft at chapters that "keep" the name (there are none).
  assert.deepEqual([...plan[0].avoid.keptByChapters], []);
  assert.match(plan[0].avoid.message, /Chase/);
  assert.doesNotMatch(plan[0].avoid.message, /already used by\b/);
});

requiredTest("SEC119 — a chapter whose plan carries no leak is never evicted", () => {
  const leaking = castContainmentFindings(
    castActionPack(16, "Put the Ask in Writing, Not in a Chase"),
    usedExampleCast(castBlueprint(16), castExamplePack(16)),
    16,
  );
  const clean = castContainmentFindings(
    castActionPack(3, "Put the Ask in Writing"),
    usedExampleCast(castBlueprint(3), castExamplePack(3)),
    3,
  );
  assert.deepEqual(clean, [], "a plan that names nobody produces no SEC119 finding");

  const plan = planAssemblyEvictions(
    structureAssemblyBlockers([...leaking, ...clean]),
    new Map([[3, chapterId(3)], [16, chapterId(16)]]),
  );
  assert.deepEqual(plan.map((eviction) => eviction.chapterNumber), [16], "only the leaking chapter is evicted");
});

// ---------------------------------------------------------------------------
// SEC90 — a BOOK-TOTAL budget gate. The plan evicts the heaviest contributing
// (chapter, kind) packs, in descending contribution order, until the removed
// contributions cover the overage (total - budget) — and no further.
// ---------------------------------------------------------------------------

function budgetBlocker(
  chapterNumber: number,
  kind: SectionKind,
  count: number,
  path: string,
  total = 64,
  budget = 15,
): AssemblyBlocker {
  return {
    chapterNumber,
    kind,
    checkId: SEC90,
    signature: "softban:rather than",
    phrase: "rather than",
    message: `soft-banned phrase "rather than" appears ${total} time(s) across available section artifacts (budget ${budget}); this field contributes ${count}. ${path}`,
    count,
    total,
    budget,
  };
}

requiredTest("SEC90 — budget mode evicts the minimal descending-contribution prefix that clears the overage", () => {
  // The canary survey: 64 uses against a budget of 15 → 49 must go.
  const blockers: AssemblyBlocker[] = [
    budgetBlocker(1, "learning-pack", 8, "/quiz/0/prompt"),
    budgetBlocker(1, "learning-pack", 6, "/quiz/1/explanation"),
    budgetBlocker(8, "learning-pack", 5, "/quiz/0/prompt"),
    budgetBlocker(1, "example-pack", 4, "/examples/0/scenario"),
    budgetBlocker(12, "example-pack", 4, "/examples/0/scenario"),
    budgetBlocker(12, "learning-pack", 4, "/quiz/0/prompt"),
    budgetBlocker(2, "learning-pack", 20, "/quiz/0/prompt"),
    budgetBlocker(5, "summary-pack", 13, "/breakdown/fullRead"),
  ];
  const chapterIds = new Map<number, string>([1, 2, 5, 8, 12].map((n) => [n, chapterId(n)] as const));
  const plan = planAssemblyEvictions(blockers, chapterIds);

  // Contributions per (chapter, kind): ch02 learning 20, ch01 learning 14 (8+6),
  // ch05 summary 13, ch08 learning 5, ch01 example 4, ch12 example 4, ch12 learning 4.
  // Descending: 20 + 14 + 13 = 47 < 49, + 5 = 52 >= 49 → four packs, then stop.
  assert.deepEqual(
    plan.map((eviction) => `${eviction.chapterNumber}:${eviction.kind}`),
    ["2:learning-pack", "1:learning-pack", "5:summary-pack", "8:learning-pack"],
  );
  // The evicted kind comes from the BLOCKER, not from a fixed policy kind.
  assert.ok(plan.some((eviction) => eviction.kind === "summary-pack"), "a summary pack can be evicted by SEC90");
  for (const eviction of plan) {
    assert.equal(eviction.avoid.checkId, SEC90);
    assert.equal(eviction.avoid.phrase, "rather than");
    assert.deepEqual([...eviction.avoid.keptByChapters], [], "a budget overage keeps no chapter's copy of the phrase");
    assert.match(eviction.avoid.message, /rather than/);
    assert.match(eviction.avoid.message, /64/);
    assert.match(eviction.avoid.message, /15/);
  }
});

requiredTest("SEC90 — ties evict the later chapter first, and the later-drafted kind first", () => {
  const blockers: AssemblyBlocker[] = [
    budgetBlocker(3, "learning-pack", 10, "/quiz/0/prompt", 30, 15),
    budgetBlocker(9, "learning-pack", 10, "/quiz/0/prompt", 30, 15),
    budgetBlocker(9, "action-pack", 10, "/tryThisNow", 30, 15),
  ];
  const chapterIds = new Map<number, string>([[3, chapterId(3)], [9, chapterId(9)]]);
  const plan = planAssemblyEvictions(blockers, chapterIds);
  // Overage 15: ch09 action (later chapter, later-drafted kind) then ch09 learning
  // reaches 20 >= 15; ch03 keeps its copy.
  assert.deepEqual(
    plan.map((eviction) => `${eviction.chapterNumber}:${eviction.kind}`),
    ["9:action-pack", "9:learning-pack"],
  );
});

requiredTest("SEC90 — with no machine-readable numbers the plan evicts every contributing pack rather than guessing a threshold", () => {
  const bare = (chapterNumber: number, kind: SectionKind): AssemblyBlocker => ({
    chapterNumber,
    kind,
    checkId: SEC90,
    signature: "softban:rather than",
    phrase: "rather than",
    message: `soft-banned phrase "rather than" is over budget; this field contributes some of it`,
  });
  const blockers = [bare(1, "learning-pack"), bare(1, "learning-pack"), bare(4, "summary-pack"), bare(7, "action-pack")];
  const chapterIds = new Map<number, string>([[1, chapterId(1)], [4, chapterId(4)], [7, chapterId(7)]]);
  const plan = planAssemblyEvictions(blockers, chapterIds);
  assert.deepEqual(
    new Set(plan.map((eviction) => `${eviction.chapterNumber}:${eviction.kind}`)),
    new Set(["1:learning-pack", "4:summary-pack", "7:action-pack"]),
    "every distinct (chapter, kind) that contributed is evicted when the overage is unknown",
  );
  for (const eviction of plan) assert.equal(eviction.avoid.checkId, SEC90);
});

requiredTest("SEC90 — a phrase inside its budget never reaches the planner (the gate did not fire)", () => {
  // The gate only emits blockers when total > budget, so an in-budget phrase has
  // no blockers at all; the planner must not invent an eviction from an empty set.
  assert.deepEqual(planAssemblyEvictions([], new Map([[1, chapterId(1)]])), []);
  // And a group whose recorded total is at or under its budget evicts nothing.
  const plan = planAssemblyEvictions(
    [budgetBlocker(1, "learning-pack", 3, "/quiz/0/prompt", 15, 15)],
    new Map([[1, chapterId(1)]]),
  );
  assert.deepEqual(plan, []);
});

// ---------------------------------------------------------------------------
// The live SEC90 gate: stamped signature + machine-readable numbers reach the
// planner from a real checkSectionGate run over assembled packs.
// ---------------------------------------------------------------------------

requiredTest("SEC90 — the live gate stamps signature/count/total/budget and drives a real eviction", () => {
  const base = compileCreditFixture(BOOK);
  const overBudget = "You act rather than wait, rather than stall, rather than drift, rather than guess, rather than hope, rather than delay, rather than argue, rather than freeze, rather than blame, rather than defer.";
  const selectedChapters = [1, 2].map((chapterNumber) => {
    const blueprint = { ...base.blueprint, chapterNumber, chapterId: chapterId(chapterNumber) };
    const summary = {
      ...base.summary,
      chapterId: blueprint.chapterId,
      breakdown: { ...base.summary.breakdown, fullRead: `${base.summary.breakdown.fullRead} ${overBudget}` },
    } as unknown as SummaryPackV1;
    return {
      chapterNumber,
      blueprint,
      sourcePacket: base.packet,
      sourceSidecar: undefined,
      packs: {
        "summary-pack": summary,
        "example-pack": { ...base.examples, chapterId: blueprint.chapterId },
        "learning-pack": { ...base.learning, chapterId: blueprint.chapterId },
        "action-pack": { ...base.action, chapterId: blueprint.chapterId },
      },
    };
  });
  const report = checkSectionGate(BOOK, {}, { selectedChapters });
  const sec90 = report.findings.filter((finding) => finding.checkId === SEC90 && finding.message.includes("rather than"));
  assert.ok(sec90.length >= 2, `expected SEC90 to fire on both chapters, saw ${sec90.length}`);
  for (const finding of sec90) {
    assert.equal(finding.signature, "softban:rather than", "SEC90 must stamp the phrase as its signature");
    assert.equal(typeof finding.count, "number", "SEC90 must carry this field's contribution");
    assert.equal(finding.total, 20, "the book total for the phrase");
    assert.equal(finding.budget, 15, "the per-book budget is unchanged at 15");
  }

  const blockers = structureAssemblyBlockers(report.findings).filter((blocker) => blocker.checkId === SEC90);
  assert.ok(blockers.length >= 2, "the stamped findings project into AssemblyBlockers");
  const plan = planAssemblyEvictions(
    blockers,
    new Map(selectedChapters.map((chapter) => [chapter.chapterNumber, chapter.blueprint.chapterId])),
  );
  // Overage 5; ch02's summary contributes 10, so evicting it alone clears the book.
  assert.deepEqual(plan.map((eviction) => `${eviction.chapterNumber}:${eviction.kind}`), ["2:summary-pack"]);
});

// ---------------------------------------------------------------------------
// Registry invariants: both new checkIds are registered exactly once, and stay
// disjoint from the documented-exempt registry.
// ---------------------------------------------------------------------------

requiredTest("registry — SEC119 and SEC90 are each registered exactly once and never also exempt", () => {
  const sec119 = CROSS_CHAPTER_EVICTION_POLICIES.get(SEC119);
  assert.ok(sec119, "SEC119 must have an eviction policy");
  assert.equal(sec119.mode === "budget" ? "budget" : "keep-earliest", "keep-earliest");
  if (sec119.mode !== "budget") {
    assert.equal(sec119.maxKeptChapters, 0, "no chapter may keep a leaked cast name");
    assert.equal(sec119.kind, "action-pack");
  }
  const sec90 = CROSS_CHAPTER_EVICTION_POLICIES.get(SEC90);
  assert.ok(sec90, "SEC90 must have an eviction policy");
  assert.equal(sec90.mode, "budget", "SEC90's firing condition is a book total, not a chapter count");

  for (const checkId of [SEC119, SEC90]) {
    assert.equal(CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS.has(checkId), false, `${checkId} is evicted, not exempt`);
  }
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
