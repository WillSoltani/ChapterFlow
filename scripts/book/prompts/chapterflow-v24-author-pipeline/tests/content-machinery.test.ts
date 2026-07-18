/**
 * contentMachinery + contentDeviceDeal + contentDeviceRepair (2026-07-06).
 *
 * Proves the content-deal system:
 *   - the deal bans 2-3 body devices per chapter and keeps every device ≤~57%
 *     book-wide (deterministic, book-scale only);
 *   - the critic flags a book saturated by a body device and does NOT punish a
 *     varied book or mere thematic (thesis-vocabulary) repetition;
 *   - the repair planner picks a minimum-cover target set that projects every
 *     over-cap device under cap and preserves the rest;
 *   - the softened house rules keep their anti-fabrication / anti-thin protections.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import {
  CONTENT_DEVICE_IDS,
  type ContentDeviceId,
  dealContentDeviceBans,
  contentDeviceDealLines,
  detectChapterDevices,
  detectProxyNames,
} from "../src/compiler/contentDeviceDeal.js";
import { checkContentMachinery, reportContentMachinery, DEFAULT_CONTENT_MACHINERY_THRESHOLDS } from "../src/critics/contentMachinery.js";
import { planContentDeviceRepair } from "../src/critics/contentDeviceRepair.js";
import { AUTHOR_HOUSE_RULES, AUTHOR_QUALITY_BAR } from "../src/orchestrator/authorRun.js";

// A device → a marker sentence that trips exactly that detector. named-anchor-lead
// is injected into the hook (opener); practice-shell into the practice surface
// (weeklyPractice); all others into the body.
const MARKER: Record<ContentDeviceId, string> = {
  "named-anchor-lead": "", // injected into the hook (opener), not the body
  "proxy-cast": "Colleen weighs the plan and decides.",
  "second-setting": "A second case proves it travels to another team.",
  "return-proof": "The proof has to come back before you trust it.",
  "hard-detail-boundary": "Keep the hard detail home where it belongs.",
  "three-part-split": "It splits into WHY, HOW, and WHAT.",
  "practice-shell": "Each Friday, run the move again.", // injected into weeklyPractice
};

/** A chapter whose ONLY device markers are the ones in `devices`. Neutral filler is
 *  crafted to trip no detector. */
function chWithDevices(n: number, devices: ContentDeviceId[]): ChapterV21 {
  const set = new Set(devices);
  // practice-shell lands in the practice surface, not the body; the anchor lead in
  // the hook. Everything else is a body marker.
  const bodyMarkers = CONTENT_DEVICE_IDS
    .filter((d) => d !== "named-anchor-lead" && d !== "practice-shell" && set.has(d))
    .map((d) => MARKER[d]);
  const hook = set.has("named-anchor-lead") ? `Apple in ${1976 + n} made a clear call.` : `A team faced a plain choice in year ${n}.`;
  // A calendar-ritual shell trips practice-shell; the neutral default (a trigger-anchored
  // practice) trips nothing.
  const weeklyPractice = set.has("practice-shell") ? MARKER["practice-shell"] : "Before your next handoff, name who checks the promise.";
  return {
    number: n,
    hook,
    counterintuition: "The obvious read misleads.",
    keyTakeaway: `Lesson ${n}: do the work. ${bodyMarkers.join(" ")}`.trim(),
    breakdown: { fastRead: "The team acts and learns.", deepRead: "The idea unfolds cleanly.", fullRead: "Detail lives in one place." },
    examples: [],
    reviewCards: [],
    quiz: { passingScorePercent: 70, questions: [] },
    memorableLines: [],
    implementationPlan: { weeklyPractice },
  } as unknown as ChapterV21;
}

// ── the deal ─────────────────────────────────────────────────────────────────
test("content-device deal: bans 2-3 devices per chapter, deterministic, and only at book scale", () => {
  assert.deepEqual(dealContentDeviceBans(3, 2), [], "no deal below book scale (N<4)");
  for (let n = 1; n <= 14; n++) {
    const bans = dealContentDeviceBans(n, 14);
    assert.ok(bans.length >= 2 && bans.length <= 3, `ch${n} bans 2-3 devices (got ${bans.length})`);
    assert.deepEqual(bans, dealContentDeviceBans(n, 14), "deterministic");
  }
});

test("content-device deal: every device is banned in ~half the book → present ≤ 60% by construction", () => {
  const banCount = new Map<ContentDeviceId, number>();
  for (let n = 1; n <= 14; n++) for (const d of dealContentDeviceBans(n, 14)) banCount.set(d, (banCount.get(d) ?? 0) + 1);
  for (const d of CONTENT_DEVICE_IDS) {
    const banned = banCount.get(d) ?? 0;
    const presentFrac = (14 - banned) / 14;
    assert.ok(presentFrac <= 0.6, `${d} present in ${Math.round(presentFrac * 100)}% ≤ 60% (banned ${banned}/14)`);
  }
});

test("content-device deal: renders explicit ban lines for the writer (fires at book scale)", () => {
  const lines = contentDeviceDealLines(1, 14);
  assert.ok(lines.some((l) => l.includes("CONTENT DEVICES")), "has the section header");
  assert.ok(lines.some((l) => l.toLowerCase().includes("do not")), "carries explicit prohibitions");
  assert.deepEqual(contentDeviceDealLines(1, 3), [], "no render below book scale");
});

// ── detection ────────────────────────────────────────────────────────────────
test("content-device detect: a chapter's markers are detected; a clean chapter has none", () => {
  const used = detectChapterDevices(chWithDevices(1, ["proxy-cast", "return-proof"]));
  assert.ok(used.has("proxy-cast") && used.has("return-proof"), "detects the two injected devices");
  const clean = detectChapterDevices(chWithDevices(2, []));
  assert.equal(clean.size, 0, "clean chapter trips no detector");
});

test("content-device detect: proxy detection excludes real names + stopwords, catches invented given-names", () => {
  assert.deepEqual(detectProxyNames("Apple ships fast. She reads it. Trust returns."), [], "Apple/She/Trust are not proxies");
  assert.deepEqual(detectProxyNames("Colleen sorts the pile."), ["Colleen"], "an invented given-name subject is a proxy");
  assert.ok(!detectProxyNames("Damasio studied the brain.").includes("Damasio"), "a real source name is not a proxy");
});

// ── the critic ───────────────────────────────────────────────────────────────
test("contentMachinery: a book saturated by return-proof + proxy fires CM0 (major)", () => {
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, ["proxy-cast", "return-proof"]));
  const findings = checkContentMachinery(chapters);
  assert.ok(findings.some((f) => f.catalogId === "CM.return-proof"), "flags return-proof over cap");
  assert.ok(findings.some((f) => f.catalogId === "CM.proxy-cast"), "flags proxy-cast over cap");
  const agg = findings.find((f) => f.catalogId === "CM0.content_machinery_monoculture");
  assert.ok(agg && agg.severity === "major", "aggregate CM0 is a major advisory");
});

test("contentMachinery (F-06): CM0 stays major under advisory; a SEVERE (≥ axesBlock over-cap) book blocks only under enforce; a 2-device book stays major under enforce (axesBlock consumed)", () => {
  // FOUR body devices in every chapter → 4 devices over cap → a SEVERE mold.
  const fourDevices: ContentDeviceId[] = ["proxy-cast", "second-setting", "return-proof", "hard-detail-boundary"];
  const severe = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, fourDevices));
  const report = reportContentMachinery(severe);
  assert.ok(
    report.overCapDevices.length >= DEFAULT_CONTENT_MACHINERY_THRESHOLDS.axesBlock,
    `severe fixture has ≥ axesBlock over-cap devices (got ${report.overCapDevices.length})`,
  );
  assert.equal(
    checkContentMachinery(severe, DEFAULT_CONTENT_MACHINERY_THRESHOLDS, "advisory").find((f) => f.catalogId === "CM0.content_machinery_monoculture")?.severity,
    "major",
    "advisory keeps a SEVERE CM0 major (byte-identical to before the flag)",
  );
  assert.equal(
    checkContentMachinery(severe, DEFAULT_CONTENT_MACHINERY_THRESHOLDS, "enforce").find((f) => f.catalogId === "CM0.content_machinery_monoculture")?.severity,
    "blocker",
    "enforce promotes a SEVERE CM0 to a hard blocker",
  );

  // TWO devices over cap → CM0 fires (≥ axesWarn) but is NOT severe (< axesBlock).
  // It must stay major even under enforce — the promotion consumes axesBlock, not axesWarn.
  const twoDevices: ContentDeviceId[] = ["proxy-cast", "return-proof"];
  const nonSevere = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, twoDevices));
  const nsReport = reportContentMachinery(nonSevere);
  assert.ok(
    nsReport.overCapDevices.length >= DEFAULT_CONTENT_MACHINERY_THRESHOLDS.axesWarn &&
      nsReport.overCapDevices.length < DEFAULT_CONTENT_MACHINERY_THRESHOLDS.axesBlock,
    `non-severe fixture fires axesWarn..<axesBlock over-cap devices (got ${nsReport.overCapDevices.length})`,
  );
  assert.equal(
    checkContentMachinery(nonSevere, DEFAULT_CONTENT_MACHINERY_THRESHOLDS, "enforce").find((f) => f.catalogId === "CM0.content_machinery_monoculture")?.severity,
    "major",
    "a non-severe CM0 stays major even under enforce (calibration guard)",
  );
});

test("contentMachinery: a VARIED book (each device ≤ half) fires nothing", () => {
  // Rotate one device per chapter so no device exceeds the cap.
  const bodyDevices = CONTENT_DEVICE_IDS.filter((d) => d !== "named-anchor-lead");
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, [bodyDevices[i % bodyDevices.length]]));
  const report = reportContentMachinery(chapters);
  for (const u of report.usage) assert.ok(!u.overCap, `${u.id} at ${Math.round(u.frac * 100)}% is under cap`);
  assert.deepEqual(checkContentMachinery(chapters), [], "no findings on a varied book");
});

test("contentMachinery: a book saturated by the practice-shell fires CM.practice-shell; a rotated book is silent (F-07)", () => {
  // Every chapter closes on a fixed calendar ritual → over cap.
  const saturated = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, ["practice-shell"]));
  const findings = checkContentMachinery(saturated);
  assert.ok(findings.some((f) => f.catalogId === "CM.practice-shell"), "flags practice-shell over cap on a saturated book");
  // Only the first 4 chapters use the calendar shell (28.6% < 60% cap) → no finding.
  const rotated = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, i < 4 ? ["practice-shell"] : []));
  assert.ok(
    !checkContentMachinery(rotated).some((f) => f.catalogId === "CM.practice-shell"),
    "a book whose practice-shell is under cap does not fire",
  );
});

test("content-device deal: the 7-device rotation includes practice-shell and keeps it ≤ 60% (planar difference set, F-07)", () => {
  assert.equal(CONTENT_DEVICE_IDS.length, 7, "catalog is 7 devices");
  let practiceShellBans = 0;
  for (let n = 1; n <= 14; n++) {
    const bans = dealContentDeviceBans(n, 14);
    assert.equal(bans.length, 3, `ch${n} bans exactly 3 of 7 devices`);
    if (bans.includes("practice-shell")) practiceShellBans++;
  }
  // {0,1,3} mod 7 over 14 chapters bans each device exactly 6/14 → present 8/14 ≈ 57%.
  assert.equal(practiceShellBans, 6, "practice-shell is banned in exactly 6/14 chapters");
  assert.ok((14 - practiceShellBans) / 14 <= 0.6, "practice-shell present in ≤ 60% of chapters by construction");
});

test("contentMachinery: mere thematic (thesis-vocabulary) repetition is NOT churn", () => {
  // Every chapter repeats the book's thesis words but uses NO body device machinery.
  const chapters = Array.from({ length: 14 }, (_, i) =>
    ({
      number: i + 1,
      hook: "Belief and purpose drive trust.",
      counterintuition: "Why matters more than what.",
      keyTakeaway: "A clear why builds loyalty and trust in your team.",
      breakdown: { fastRead: "Purpose first, belief next.", deepRead: "Trust follows a clear why.", fullRead: "Loyalty grows from purpose." },
      examples: [], reviewCards: [], quiz: { passingScorePercent: 70, questions: [] }, memorableLines: [],
      implementationPlan: { weeklyPractice: "State your why." },
    } as unknown as ChapterV21),
  );
  assert.deepEqual(checkContentMachinery(chapters), [], "repeated thesis vocabulary alone does not trip the critic");
});

// ── the repair planner ───────────────────────────────────────────────────────
test("contentDeviceRepair: plans a minimum-cover target set that clears every over-cap device", () => {
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, ["proxy-cast", "return-proof"]));
  const plan = planContentDeviceRepair(chapters, { targetCap: 8 });
  assert.ok(plan.fired, "plan fires on a saturated book");
  assert.deepEqual(plan.residualOverCap, [], "projected: every device under cap after the targets");
  const targetSet = new Set(plan.targets.map((t) => t.chapterNumber));
  for (const n of plan.preserved) assert.ok(!targetSet.has(n), `preserved ch${n} is not also a target`);
  for (const t of plan.targets) {
    assert.ok(t.usedOverCap.includes("proxy-cast") || t.usedOverCap.includes("return-proof"), "each target actually carries an over-cap device");
    assert.ok(t.directive.includes("CONTENT-DEAL SAMENESS REPAIR"), "directive is the content-deal repair directive");
    assert.ok(/never present an invented person|fabricated example/i.test(t.directive), "directive carries the example-grounding guard");
  }
});

test("contentDeviceRepair: forceChapters retries EXACTLY the requested chapters", () => {
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, ["proxy-cast", "return-proof"]));
  const plan = planContentDeviceRepair(chapters, { forceChapters: [9, 11] });
  assert.deepEqual(plan.targets.map((t) => t.chapterNumber), [9, 11], "targets exactly the forced chapters, in order");
});

test("contentDeviceRepair: a book with no over-cap device does not fire", () => {
  const bodyDevices = CONTENT_DEVICE_IDS.filter((d) => d !== "named-anchor-lead");
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, [bodyDevices[i % bodyDevices.length]]));
  assert.equal(planContentDeviceRepair(chapters).fired, false, "no over-cap device → no repair");
});

// ── content-device protections preserved through the IMP-05 diet ──────────────
test("the dieted craft targets keep the anti-thin example bar + point to the content-device deal", () => {
  // IMP-05 compacted rules 6/7 into the single EXAMPLES craft target; the anti-thin
  // (completed consequence) protection + the content-device-deal pointer survive,
  // and the card never hard-mandates the return-proof device.
  assert.match(AUTHOR_QUALITY_BAR, /completed consequence/i, "the completed-consequence anti-thin bar survives");
  assert.match(AUTHOR_QUALITY_BAR, /An arc that never lands is unfinished/i, "the unfinished-arc bar survives");
  assert.ok(!/what proof returns, when it comes back/.test(AUTHOR_QUALITY_BAR), "no hard-mandated return-proof device");
  assert.match(AUTHOR_QUALITY_BAR, /CONTENT DEVICES deal/i, "the craft target points to the per-chapter content-device deal");
  // Anti-fabrication now lives in the FACTUAL invariant + the source-use plan.
  assert.match(AUTHOR_HOUSE_RULES, /invent connective narration, never facts/i, "anti-fabrication moved to the FACTUAL invariant");
});
