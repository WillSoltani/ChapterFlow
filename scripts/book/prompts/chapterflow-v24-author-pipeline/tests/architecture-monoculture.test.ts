/**
 * architectureMonoculture — book-level structural-skeleton sameness (2026-07-05).
 *
 * Proves the critic catches a book where every chapter runs ONE delivery skeleton
 * (the "churn HIGH" the book-acceptance panel rejects) while the surface critics
 * pass, and does NOT punish a book with controlled variation or mere thematic
 * consistency.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import {
  checkArchitectureMonoculture,
  DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS,
} from "../src/critics/architectureMonoculture.js";
import { ARCHITECTURE_FAMILIES, dealBriefRotations, twoThirdsCap } from "../src/compiler/briefRotation.js";
import { briefVarietyInstructionLines } from "../src/compiler/chapterBrief.js";
import type { ChapterBriefV1 } from "../src/artifacts/artifactTypes.js";

/** A minimal chapter carrying only the fields the critic reads. */
function ch(n: number, over: Partial<ChapterV21>): ChapterV21 {
  return {
    number: n,
    hook: "A plain hook about a decision.",
    keyTakeaway: "Do the work.",
    breakdown: { fastRead: "", deepRead: "", fullRead: "" },
    memorableLines: [],
    implementationPlan: { weeklyPractice: "" },
    ...over,
  } as unknown as ChapterV21;
}

test("architecture-monoculture: a book where every chapter shares the practice shell + reversal device + one lead anchor fires ARCH0", () => {
  // 12 chapters all: "Each Friday…" practice shell + a return/receipt memorable
  // line + Apple leading the opening. Surface words vary; the SKELETON repeats.
  const chapters = Array.from({ length: 12 }, (_, i) =>
    ch(i + 1, {
      hook: `Apple in ${1976 + i} shows the move number ${i + 1}.`,
      breakdown: { fastRead: `Apple's ${i + 1}th decision opens the chapter.`, deepRead: "", fullRead: "" },
      keyTakeaway: `Start with the reason, then name the way, then judge the result number ${i + 1}.`,
      memorableLines: [{ text: `Proof is the return trip, not the starting gun — take ${i + 1}.` } as never],
      implementationPlan: { weeklyPractice: `Each Friday, if one promise drifted number ${i + 1}, then write the missing proof.` } as never,
    }),
  );
  const findings = checkArchitectureMonoculture(chapters);
  const ids = findings.map((f) => f.catalogId);
  assert.ok(ids.includes("ARCH1.practice_shell_monoculture"), "practice-shell shell detected");
  assert.ok(ids.includes("ARCH3.reversal_motif_monoculture"), "reversal device ubiquity detected");
  assert.ok(ids.includes("ARCH4.lead_anchor_overreuse"), "Apple over-reuse detected");
  const agg = findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  assert.ok(agg, "the aggregate monoculture finding fires");
  assert.equal(agg!.severity, "major", "aggregate is a surfaced advisory (major), never a silent pass");
  // It names every implicated chapter for the repair lane.
  assert.ok((agg!.chapters ?? []).length >= 10, "aggregate names the diversification targets");
});

test("architecture-monoculture: a book with controlled variation + only THEMATIC repetition passes clean", () => {
  // Distinct architectures: varied practice shells, varied anchors, only 1-2 use a
  // return device. Thesis words (belief/why/trust) repeat freely — that is NOT churn.
  const practices = [
    "Before your next handoff, name the one promise you are making.",
    "Replace one status update with a single visible proof.",
    "Script the exact sentence you will say in the meeting.",
    "Audit one old artifact for the pattern this week.",
    "Teach the move to one teammate over lunch.",
    "Timebox ten minutes to draft the belief line.",
    "Each Friday, note one decision that rose from belief.",
    "Pre-write the precise line before the review.",
    "Attach the check to a routine already in place.",
    "Measure one number your team already trusts.",
    "Walk one new hire through the origin story.",
    "Sketch the WHY on a card and pin it up.",
  ];
  const anchors = ["Toyota", "Patagonia", "Everett Rogers", "the Celery test", "Southwest", "Damasio",
    "the Wright brothers", "Harley-Davidson", "Costco", "NASA", "Lego", "Basecamp"];
  const chapters = practices.map((p, i) =>
    ch(i + 1, {
      hook: `${anchors[i]} teaches something about belief and trust.`,
      breakdown: { fastRead: `${anchors[i]} opens with a distinct scene.`, deepRead: "", fullRead: "" },
      keyTakeaway: i % 5 === 0
        ? "Belief comes before behavior, and trust follows visible proof."   // thematic, non-compound
        : `Purpose ${i + 1} is a single clear commitment you keep.`,
      memorableLines: i < 2 ? [{ text: "Proof is the return trip." } as never] : [{ text: `A clear WHY ${i + 1} guides the work.` } as never],
      implementationPlan: { weeklyPractice: p } as never,
    }),
  );
  const findings = checkArchitectureMonoculture(chapters);
  const agg = findings.find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  assert.equal(agg, undefined, `a varied book must not be flagged: ${findings.map((f) => f.catalogId).join(", ")}`);
});

test("architecture-monoculture: thresholds are configurable and a <4-chapter book is never flagged", () => {
  const tiny = [ch(1, {}), ch(2, {}), ch(3, {})];
  assert.equal(checkArchitectureMonoculture(tiny).length, 0, "book-level sameness is meaningless below 4 chapters");
  // A stricter anchorCap flips a borderline book.
  const four = Array.from({ length: 4 }, (_, i) => ch(i + 1, { hook: `Apple move ${i}.`, breakdown: { fastRead: `Apple ${i}`, deepRead: "", fullRead: "" } }));
  assert.equal(checkArchitectureMonoculture(four, { ...DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, anchorCap: 10 }).filter((f) => f.catalogId === "ARCH4.lead_anchor_overreuse").length, 0, "a high anchorCap suppresses ARCH4");
});

test("architecture-monoculture (F-06): a SEVERE aggregate stays major under advisory and blocks ONLY under enforce; a non-severe aggregate never blocks", () => {
  // A 12-chapter book firing all FOUR skeleton axes (practice shell + compound
  // takeaway + reversal device + one lead anchor) — a SEVERE mold (axes ≥ axesBlock).
  const severe = Array.from({ length: 12 }, (_, i) =>
    ch(i + 1, {
      hook: `Apple in ${1976 + i} shows the move number ${i + 1}.`,
      breakdown: { fastRead: `Apple's ${i + 1}th decision opens the chapter.`, deepRead: "", fullRead: "" },
      keyTakeaway: `Start with the reason, then name the way, then judge the result number ${i + 1}.`,
      memorableLines: [{ text: `Proof is the return trip, not the starting gun — take ${i + 1}.` } as never],
      implementationPlan: { weeklyPractice: `Each Friday, if one promise drifted number ${i + 1}, then write the missing proof.` } as never,
    }),
  );
  const axesFired = checkArchitectureMonoculture(severe, DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, "advisory")
    .filter((f) => /^ARCH[1-4]\./.test(f.catalogId)).length;
  assert.ok(axesFired >= DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS.axesBlock, `severe fixture fires ≥ axesBlock axes (got ${axesFired})`);

  const advAgg = checkArchitectureMonoculture(severe, DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, "advisory")
    .find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  assert.equal(advAgg?.severity, "major", "advisory keeps a SEVERE aggregate major (byte-identical to before the flag)");

  const enfAgg = checkArchitectureMonoculture(severe, DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, "enforce")
    .find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  assert.equal(enfAgg?.severity, "blocker", "enforce promotes a SEVERE aggregate to a hard blocker");

  // A NON-severe aggregate: only ARCH1 (practice shell) + ARCH4 (lead anchor) fire
  // — ≥ axesWarn (ARCH0 surfaces) but < axesBlock (not severe). It must stay major
  // in BOTH modes: enforce promotes SEVERE molds only, never the warn tier.
  const nonSevere = Array.from({ length: 12 }, (_, i) =>
    ch(i + 1, {
      hook: `Apple in ${1976 + i} made a plain call number ${i + 1}.`,
      breakdown: { fastRead: `Apple opens scene ${i + 1} with a distinct beat.`, deepRead: "", fullRead: "" },
      keyTakeaway: `Purpose ${i + 1} is a single clear commitment you keep.`, // no "then" → not compound
      memorableLines: [{ text: `A clear reason ${i + 1} guides the work.` } as never], // no reversal motif
      implementationPlan: { weeklyPractice: `Each Friday, note one decision from step ${i + 1}.` } as never,
    }),
  );
  const nsAxes = checkArchitectureMonoculture(nonSevere, DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, "advisory")
    .filter((f) => /^ARCH[1-4]\./.test(f.catalogId)).length;
  assert.ok(
    nsAxes >= DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS.axesWarn && nsAxes < DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS.axesBlock,
    `non-severe fixture fires axesWarn..<axesBlock axes (got ${nsAxes})`,
  );
  const nsEnf = checkArchitectureMonoculture(nonSevere, DEFAULT_ARCHITECTURE_MONOCULTURE_THRESHOLDS, "enforce")
    .find((f) => f.catalogId === "ARCH0.architecture_monoculture");
  assert.equal(nsEnf?.severity, "major", "a non-severe aggregate stays major even under enforce (calibration guard)");
});

test("architecture-family deal: distinct skeletons dealt per chapter under the two-thirds cap, deterministic", () => {
  for (const n of [8, 12, 14, 20]) {
    const rot = dealBriefRotations("some-book", n);
    const fams = [...rot.values()].map((v) => v.architectureFamily);
    assert.equal(fams.length, n);
    for (const f of fams) assert.ok((ARCHITECTURE_FAMILIES as readonly string[]).includes(f), `valid family: ${f}`);
    const counts = new Map<string, number>();
    for (const f of fams) counts.set(f, (counts.get(f) ?? 0) + 1);
    const cap = twoThirdsCap(n);
    for (const [fam, c] of counts) assert.ok(c <= cap, `${fam} on ${c}/${n} exceeds the two-thirds cap ${cap}`);
    // Adjacent chapters differ where the pool allows (no immediate skeleton repeat).
    for (let i = 1; i < fams.length; i++) assert.notEqual(fams[i], fams[i - 1], `ch${i + 1} repeats ch${i}'s skeleton`);
    assert.deepEqual(fams, [...dealBriefRotations("some-book", n).values()].map((v) => v.architectureFamily), "deterministic");
  }
  assert.notDeepEqual(
    [...dealBriefRotations("book-a", 9).values()].map((v) => v.architectureFamily),
    [...dealBriefRotations("book-b", 9).values()].map((v) => v.architectureFamily),
    "per-book rotation differs",
  );
});

test("architecture-family directive renders as the FIRST structural writer instruction and prohibits the default skeleton", () => {
  const brief = {
    architectureFamily: "single-deep-case",
    openerType: "scene", challengeFrame: "audit-one-artifact", practiceShape: "two-step-sequence",
  } as ChapterBriefV1;
  const lines = briefVarietyInstructionLines(brief);
  assert.match(lines[0], /CHAPTER ARCHITECTURE \(single-deep-case\)/, "architecture directive leads");
  assert.match(lines[0], /Do NOT add a 'second setting proves it travels'/, "prohibits the default 3-anchor skeleton");
  // A pre-v5 brief without the field renders exactly the original opener line first (compat).
  const legacy = { openerType: "scene", challengeFrame: "audit-one-artifact", practiceShape: "two-step-sequence" } as ChapterBriefV1;
  assert.match(briefVarietyInstructionLines(legacy)[0], /^- OPENER:/, "legacy brief unchanged");
});

test("book-sameness repair planner: routes a MINIMAL distinct-family set, preserves already-distinct chapters, never full-rewrites", async () => {
  const { planBookSamenessRepair } = await import("../src/critics/bookSamenessRepair.js");
  // Reuse the templated 12-chapter fixture's findings shape: fabricate an aggregate
  // + per-axis findings implicating all chapters, ch1-3 by 3 axes, rest by 1.
  const findings = [
    { catalogId: "ARCH1.practice_shell_monoculture", severity: "minor" as const, message: "", chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { catalogId: "ARCH3.reversal_motif_monoculture", severity: "minor" as const, message: "", chapters: [1, 2, 3] },
    { catalogId: "ARCH4.lead_anchor_overreuse", severity: "minor" as const, message: "", chapters: [1, 2, 3] },
    { catalogId: "ARCH0.architecture_monoculture", severity: "major" as const, message: "", chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ];
  const plan = planBookSamenessRepair(findings, 12, { preserveChapters: [4, 7], targetCap: 6 });
  assert.ok(plan.fired, "plan fires when the aggregate is present");
  assert.ok(plan.targets.length <= 6, "never exceeds the target cap (no full-book rewrite)");
  // Most-implicated chapters first; preserved chapters never targeted.
  assert.deepEqual(plan.targets.slice(0, 3).map((t) => t.chapterNumber), [1, 2, 3], "most-templated chapters first");
  assert.ok(!plan.targets.some((t) => t.chapterNumber === 4 || t.chapterNumber === 7), "preserved chapters are never diversified");
  assert.ok(plan.preserved.includes(4) && plan.preserved.includes(7), "preserved set retained");
  // Distinct families across the targets (they must not collapse into one new mold).
  const fams = plan.targets.map((t) => t.assignedFamily);
  assert.equal(new Set(fams).size, fams.length, "each diversified chapter gets a DISTINCT family");
  // The directive preserves facts + prohibits the default skeleton.
  assert.match(plan.targets[0].directive, /Keep the chapter's WHY\/thesis, its source-supported facts/);
  assert.match(plan.targets[0].directive, /do NOT reuse the default named-anchor/);
  // No aggregate → no repair.
  assert.equal(planBookSamenessRepair([findings[0]], 12).fired, false, "no aggregate → no repair plan");
});
