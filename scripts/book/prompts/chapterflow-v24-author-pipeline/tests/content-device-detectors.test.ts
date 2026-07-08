/**
 * Per-detector FP/FN fixtures (Prompt 2, Requirement 6).
 *
 * The content-device detectors now GATE a repair revert (a still-present banned
 * device reverts the re-authored draft), so a false positive would wrongly discard
 * a genuinely-compliant chapter. This suite pins ≥2 true-positive and ≥2 near-miss
 * negative fixtures for the five detectors that previously had none (proxy-cast is
 * already covered in content-machinery.test.ts). Each negative is a realistic
 * near-miss the advisory-era regexes tripped and the narrowed regexes must not.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import type { ChapterV21 } from "../src/types.js";
import {
  type ContentDeviceId,
  detectChapterDevices,
  detectChapterDeviceMatches,
  diffChapterDeviceUse,
} from "../src/compiler/contentDeviceDeal.js";

/** A minimal chapter with device text placed in the hook (opener) and/or the body.
 *  Default filler is crafted to trip NO detector. */
function chOf(opts: { hook?: string; body?: string; practice?: string; tags?: string[] }): ChapterV21 {
  return {
    number: 1,
    hook: opts.hook ?? "A team faced a plain choice one quiet afternoon.",
    counterintuition: "The obvious read misleads.",
    keyTakeaway: opts.body ?? "Do the work and learn from it.",
    breakdown: { fastRead: "The team acts.", deepRead: "The idea unfolds cleanly.", fullRead: "One point, followed through." },
    examples: opts.tags ? [{ title: "e", tags: opts.tags } as unknown] : [],
    reviewCards: [],
    quiz: { passingScorePercent: 70, questions: [] },
    memorableLines: [],
    // practice-shell keys on the practice surface only; the neutral default is a
    // trigger-anchored practice that trips nothing.
    implementationPlan: { weeklyPractice: opts.practice ?? "Before your next handoff, name who checks the promise." },
  } as unknown as ChapterV21;
}

const trips = (id: ContentDeviceId, opts: { hook?: string; body?: string; practice?: string; tags?: string[] }): boolean =>
  detectChapterDevices(chOf(opts)).has(id);

// device → the slot its text lives in + true-positive / near-miss-negative fixtures.
type Slot = "hook" | "body" | "practice";
const MATRIX: Array<{ id: ContentDeviceId; slot: Slot; positives: string[]; negatives: string[] }> = [
  {
    id: "named-anchor-lead",
    slot: "hook",
    positives: [
      "Apple in 1997 made a clear call about focus and cut the rest.",
      "The Wright brothers ran their bicycle shop on a hunch, not a grant.",
    ],
    negatives: [
      "King Louis waved the plan through before lunch was even served.", // bare-King drop
      "Al Gore opened with a joke that landed flat in the back rows.",    // bare-Gore drop (W.L. Gore/Gore-Tex only)
    ],
  },
  {
    id: "second-setting",
    slot: "body",
    positives: [
      "A second company tried the very same move and it worked again.",
      "The pattern proves it travels to a completely different team.",
    ],
    negatives: [
      "Meanwhile, the market kept shifting under everyone's feet.",       // dropped bare `meanwhile`
      "She read the second page of the report before the meeting began.",  // "second" without the device object
    ],
  },
  {
    id: "return-proof",
    slot: "body",
    positives: [
      "The proof has to come back before anyone trusts the plan again.",
      "That number is a receipt for the promise you made out loud.",
    ],
    negatives: [
      "She kept the receipt from the hardware store tucked in her coat.",  // literal receipt
      "The proof of a promise is worth more than the promise itself.",     // prompt's own example
    ],
  },
  {
    id: "hard-detail-boundary",
    slot: "body",
    positives: [
      "Keep the hard detail home where it belongs to this one case.",
      "That specific number belongs to this case and does not travel far.",
    ],
    negatives: [
      "The kids stay home from school whenever it snows hard overnight.",   // literal "stay home"
      "The receiver stepped out of bounds near the far pylon and stopped.",  // literal "out of bounds"
    ],
  },
  {
    id: "three-part-split",
    slot: "body",
    positives: [
      "It splits into WHY, HOW, and WHAT for the reader to follow.",
      "He built the whole talk on the golden circle idea from the start.",
    ],
    negatives: [
      "Ask why the plan works, then show how the team ships what matters.", // why/how/what as ordinary words
      "The three parts of the engine each need oil to run smoothly.",        // "three parts" without split/frame
    ],
  },
  {
    id: "practice-shell",
    slot: "practice",
    // Positives are verbatim from the live start-with-why corpus (the ~13-14/14
    // saturation F-07 measured) — a fixed calendar cadence closes the practice.
    positives: [
      "Each Friday, if the same fix showed up twice, then run the Fact-First Walk before you approve it again.", // ch01
      "Each week, measure one number: how many live messages began with a reason before the method or proof.",  // ch03
      "On Friday, if one choice still feels right but has only one anchor, then write a second anchor.",         // ch04 (broader than the ARCH1 each|every regex)
      "Cross-out one floating WHAT every Friday and rewrite it as a return proof.",                              // ch12
    ],
    negatives: [
      "When a claim leaves your desk without proof, schedule the visible action before it travels.", // trigger-anchored, not a calendar ritual
      "Before your next handoff, write the one number that proves the promise landed.",              // event-anchored ("next"), not a fixed cadence
      "Write down the single promise you made today, then name who will check it.",                  // one-time ("today")
    ],
  },
];

for (const { id, slot, positives, negatives } of MATRIX) {
  test(`detector ${id}: true-positive fixtures trip the detector`, () => {
    for (const text of positives) {
      const opts = slot === "hook" ? { hook: text } : slot === "practice" ? { practice: text } : { body: text };
      assert.ok(trips(id, opts), `expected ${id} to trip on: ${text}`);
    }
  });
  test(`detector ${id}: near-miss negatives do NOT trip the detector`, () => {
    for (const text of negatives) {
      const opts = slot === "hook" ? { hook: text } : slot === "practice" ? { practice: text } : { body: text };
      assert.ok(!trips(id, opts), `expected ${id} NOT to trip on: ${text}`);
    }
  });
}

// proxy-cast common-noun / place guard (the guard added now that proxy gates a revert).
test("detector proxy-cast: a capitalized common noun or place is NOT an invented proxy", () => {
  // "Approval" caught at a sentence start, but "approval" appears lowercased elsewhere → common noun.
  assert.ok(!trips("proxy-cast", { body: "Approval holds the launch. The team waits for approval before shipping." }), "Approval is a common noun, not a proxy");
  // A place from the book's source (Cupertino) with a present-tense verb → excluded.
  assert.ok(!trips("proxy-cast", { body: "Cupertino sets the tone for the whole product line each spring." }), "Cupertino is a place, not a proxy");
  // A genuinely invented given-name still trips.
  assert.ok(trips("proxy-cast", { body: "Colleen weighs the plan and decides to ship it anyway." }), "an invented given-name is still a proxy");
});

// return-proof also fires from an example tag (the deal keys on tags too).
test("detector return-proof: an example return-proof tag trips it; an unrelated tag does not", () => {
  assert.ok(trips("return-proof", { tags: ["return proof"] }), "return-proof tag trips");
  assert.ok(!trips("return-proof", { tags: ["case study", "aviation"] }), "unrelated tags do not");
});

// ── match evidence + diff helpers ─────────────────────────────────────────────
test("detectChapterDeviceMatches: returns a naming snippet for each detected device", () => {
  const matches = detectChapterDeviceMatches(
    chOf({ hook: "Apple in 1997 made a clear call.", body: "The proof has to come back before you trust it." }),
  );
  const byId = new Map(matches.map((m) => [m.id, m.snippet]));
  assert.ok(byId.has("named-anchor-lead") && /Apple/.test(byId.get("named-anchor-lead")!), "anchor snippet names Apple");
  assert.ok(byId.has("return-proof") && byId.get("return-proof")!.length > 0, "return-proof has a non-empty snippet");
});

test("diffChapterDeviceUse: persisted = banned∩after; substituted = new non-banned; catalog order; substitution never counts a banned device", () => {
  const before = new Set<ContentDeviceId>(["proxy-cast"]);
  const after = new Set<ContentDeviceId>(["proxy-cast", "second-setting", "three-part-split"]);
  const banned: ContentDeviceId[] = ["proxy-cast", "return-proof"];
  const diff = diffChapterDeviceUse(before, after, banned);
  // proxy-cast is banned AND still present → persisted. return-proof banned but absent → not persisted.
  assert.deepEqual(diff.persisted, ["proxy-cast"], "only the still-present banned device persists");
  // second-setting + three-part-split are new and NOT banned → substituted; proxy-cast was already present (not new).
  assert.deepEqual(diff.substituted, ["second-setting", "three-part-split"], "new non-banned devices, in catalog order");
  // A newly-present BANNED device is persisted, never substituted.
  const d2 = diffChapterDeviceUse(new Set(), new Set<ContentDeviceId>(["return-proof"]), ["return-proof"]);
  assert.deepEqual(d2.persisted, ["return-proof"]);
  assert.deepEqual(d2.substituted, [], "a banned device is never miscounted as a substitution");
});
