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
import { checkContentMachinery, reportContentMachinery } from "../src/critics/contentMachinery.js";
import { planContentDeviceRepair } from "../src/critics/contentDeviceRepair.js";
import { AUTHOR_QUALITY_BAR } from "../src/orchestrator/authorRun.js";

// A device → a marker sentence that trips exactly that detector.
const MARKER: Record<ContentDeviceId, string> = {
  "named-anchor-lead": "", // injected into the hook (opener), not the body
  "proxy-cast": "Colleen weighs the plan and decides.",
  "second-setting": "A second case proves it travels to another team.",
  "return-proof": "The proof has to come back before you trust it.",
  "hard-detail-boundary": "Keep the hard detail home where it belongs.",
  "three-part-split": "It splits into WHY, HOW, and WHAT.",
};

/** A chapter whose ONLY device markers are the ones in `devices`. Neutral filler is
 *  crafted to trip no detector. */
function chWithDevices(n: number, devices: ContentDeviceId[]): ChapterV21 {
  const set = new Set(devices);
  const bodyMarkers = CONTENT_DEVICE_IDS.filter((d) => d !== "named-anchor-lead" && set.has(d)).map((d) => MARKER[d]);
  const hook = set.has("named-anchor-lead") ? `Apple in ${1976 + n} made a clear call.` : `A team faced a plain choice in year ${n}.`;
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
    implementationPlan: { weeklyPractice: "Practice the move." },
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

test("contentMachinery: a VARIED book (each device ≤ half) fires nothing", () => {
  // Rotate one device per chapter so no device exceeds the cap.
  const bodyDevices = CONTENT_DEVICE_IDS.filter((d) => d !== "named-anchor-lead");
  const chapters = Array.from({ length: 14 }, (_, i) => chWithDevices(i + 1, [bodyDevices[i % bodyDevices.length]]));
  const report = reportContentMachinery(chapters);
  for (const u of report.usage) assert.ok(!u.overCap, `${u.id} at ${Math.round(u.frac * 100)}% is under cap`);
  assert.deepEqual(checkContentMachinery(chapters), [], "no findings on a varied book");
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

// ── house-rule protections preserved ─────────────────────────────────────────
test("softened house rules 6/7 keep the anti-fabrication + anti-thin protections", () => {
  assert.ok(/never invent facts to manufacture one/i.test(AUTHOR_QUALITY_BAR), "rule 7 keeps the anti-fabrication clause");
  assert.ok(/COMPLETED CONSEQUENCE/.test(AUTHOR_QUALITY_BAR), "rule 7 keeps the completed-consequence anti-thin bar");
  assert.ok(!/what proof returns, when it comes back/.test(AUTHOR_QUALITY_BAR), "rule 6 no longer hard-mandates the return-proof device");
  assert.ok(/CONTENT DEVICES deal/.test(AUTHOR_QUALITY_BAR), "rules point to the per-chapter content-device deal");
});
