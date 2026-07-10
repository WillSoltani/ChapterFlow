/**
 * readerBudgets (v24 B3) — five deterministic reader-correlated checks.
 *
 * Fixtures are synthetic (tests/helpers.ts makeChapter + inline packets);
 * nothing here touches canonical state. Each check has a firing and a
 * non-firing fixture plus the threshold-boundary cases from the build spec.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import {
  asText,
  checkReaderBudgets,
  classifyOpener,
  estimatedRenderedChars,
  hasOptionMenu,
  hasQuotedScript,
  openerSignature,
  practiceSignature,
  quizViews,
  scaffoldFamily,
  type BudgetFinding,
} from "../src/critics/readerBudgets.js";

const BOOK = "zz-fixture-reader-budgets";

function makePacket(n: number, caseLabels: string[]): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: [],
    namedCases: caseLabels.map((label, i) => ({
      id: `ch${n}.case.${i + 1}`,
      label,
      summary: `${label} summary.`,
      realWorld: true,
      hardSpecifics: [],
      allowedUses: [],
      forbiddenUses: [],
      doNotRestamp: [],
    })),
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
  };
}

function packetsFor(entries: Array<[number, string[]]>): Map<number, SourcePacketV1> {
  return new Map(entries.map(([n, labels]) => [n, makePacket(n, labels)]));
}

function only(findings: BudgetFinding[], checkId: string): BudgetFinding[] {
  return findings.filter((f) => f.checkId === checkId);
}

/** Two clean chapters with disjoint word banks — the baseline every negative
 *  test builds from. */
function cleanPair(): [ChapterV21, ChapterV21] {
  return [makeChapter(BOOK, 1), makeChapter(BOOK, 2)];
}

// ── CHB1: anchor repetition ─────────────────────────────────────────────────

test("CHB1 severity is BANDED (convergence-safe 2026-07-05): just over cap is ADVISORY; egregious hammering (≥ 2×cap) is a blocker", () => {
  // 'popsicle' and 'hotline' tie on document frequency (both only in ch1);
  // the longer token wins, so 'popsicle' is the counted anchor.
  const build = (mentions: number): ChapterV21[] => {
    const [ch1, ch2] = cleanPair();
    ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(mentions - 1);
    return [ch1, ch2];
  };
  const packets = packetsFor([[1, ["Popsicle Hotline"]], [2, ["Emerson Electric"]]]);
  // 7 mentions (one over cap 6) — a packet anchor, but minor repetition → ADVISORY,
  // so it no longer routes an otherwise-passing chapter into a full re-author.
  const minor = only(checkReaderBudgets(build(7), { packets }), "CHB1.anchor_repetition");
  assert.equal(minor.length, 1);
  assert.equal(minor[0].severity, "advisory", "one over cap is minor repetition → advisory");
  assert.equal(minor[0].chapterNumber, 1);
  assert.match(minor[0].message, /"popsicle"/);
  // 12 mentions (≥ repCap*CHB1_HARD_ANCHOR_MULT = 12) — egregious hammering, the
  // band where SEAM2/the reader panel co-fire → stays a BLOCKER.
  const egregious = only(checkReaderBudgets(build(12), { packets }), "CHB1.anchor_repetition");
  assert.equal(egregious.length, 1);
  assert.equal(egregious[0].severity, "blocker", "≥ 2×cap is egregious → blocker");
});

test("CHB1 boundary: count == repCap(6) passes; count 7 fires at cap 6 but passes at --rep-cap 7", () => {
  const build = (mentions: number): ChapterV21[] => {
    const [ch1, ch2] = cleanPair();
    ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(mentions - 1);
    return [ch1, ch2];
  };
  const packets = packetsFor([[1, ["Popsicle Hotline"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets(build(6), { packets }), "CHB1.anchor_repetition").length, 0, "exactly at cap must pass");
  assert.equal(only(checkReaderBudgets(build(7), { packets }), "CHB1.anchor_repetition").length, 1, "one over cap must fire");
  assert.equal(only(checkReaderBudgets(build(7), { packets, repCap: 7 }), "CHB1.anchor_repetition").length, 0, "raised cap must pass");
});

test("CHB1 without packets (title-fallback labels) reports ADVISORY, not blocker", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].title = "The Popsicle Hotline";
  ch1.breakdown.deepRead += " The popsicle hotline rang." + " The popsicle stayed cold.".repeat(6);
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB1.anchor_repetition");
  const popsicle = findings.filter((f) => /"popsicle"/.test(f.message));
  assert.equal(popsicle.length, 1);
  assert.ok(findings.every((f) => f.severity === "advisory"), "every title-fallback CHB1 finding must be advisory");
});

test("CHB1 SEC119 lesson: common-word person tokens (Grant/Chase) are never counted", () => {
  const [ch1, ch2] = cleanPair();
  ch1.breakdown.deepRead += " They grant access to the grant desk.".repeat(8);
  const packets = packetsFor([[1, ["Grant Chase"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB1.anchor_repetition").length, 0);
});

test("CHB1 skips concept-cases whose label has no capitalized anchor token (packet path)", () => {
  const [ch1, ch2] = cleanPair();
  // 'coverage' repeats 9x on the reading surface — but "Bond interest
  // coverage" names a concept the chapter teaches, not a source anchor.
  ch1.breakdown.deepRead += " The coverage ratio moved again.".repeat(9);
  const packets = packetsFor([[1, ["Bond interest coverage"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB1.anchor_repetition").length, 0);
});

// ── CHB2: length budget ─────────────────────────────────────────────────────

test("CHB2 severity bands: 20-30% out is advisory, beyond 30% blocks (publish calibration 2026-07-04)", () => {
  const [ch1, ch2] = cleanPair();
  const est = estimatedRenderedChars(ch1);
  // Publish calibration (2026-07-04): severity BANDS — 20-30% out = ADVISORY
  // (a 1.6% overflow once halted a 9x85+ book), beyond 30% = BLOCKER.
  const advisory = only(checkReaderBudgets([ch1, ch2], { lengthBudget: { renderedChars: Math.round(est / 1.25), tolerance: 0.2 } }), "CHB2.length_budget");
  assert.ok(advisory.length >= 1);
  assert.equal(advisory[0].severity, "advisory", "25% over = advisory band");
  const blocker = only(checkReaderBudgets([ch1, ch2], { lengthBudget: { renderedChars: Math.round(est / 1.45), tolerance: 0.2 } }), "CHB2.length_budget");
  assert.ok(blocker.length >= 1);
  assert.equal(blocker[0].severity, "blocker", "45% over = blocker");
  assert.match(blocker[0].message, /over/);
});

test("CHB2 passes when every chapter sits inside budget*(1±tolerance)", () => {
  const [ch1, ch2] = cleanPair();
  const budget = { renderedChars: Math.round((estimatedRenderedChars(ch1) + estimatedRenderedChars(ch2)) / 2), tolerance: 0.2 };
  assert.equal(only(checkReaderBudgets([ch1, ch2], { lengthBudget: budget }), "CHB2.length_budget").length, 0);
});

test("CHB2 boundary: the ±20% edge is inclusive (a few chars inside passes, a few outside fires)", () => {
  const [ch1] = cleanPair();
  const est = estimatedRenderedChars(ch1);
  // hi-edge: budget*1.2 lands ~2.4 chars ABOVE est → inside, must pass.
  const justInside = { renderedChars: Math.ceil(est / 1.2) + 2, tolerance: 0.2 };
  assert.equal(only(checkReaderBudgets([ch1], { lengthBudget: justInside }), "CHB2.length_budget").length, 0);
  // hi-edge: budget*1.2 lands ~2.4 chars BELOW est → est is over, must fire.
  const justOutside = { renderedChars: Math.floor(est / 1.2) - 2, tolerance: 0.2 };
  const over = only(checkReaderBudgets([ch1], { lengthBudget: justOutside }), "CHB2.length_budget");
  assert.equal(over.length, 1);
  assert.match(over[0].message, /over/);
  // lo-edge mirror: budget*0.8 lands just above est → under, must fire.
  const underBudget = { renderedChars: Math.ceil(est / 0.8) + 4, tolerance: 0.2 };
  const under = only(checkReaderBudgets([ch1], { lengthBudget: underBudget }), "CHB2.length_budget");
  assert.equal(under.length, 1);
  assert.match(under[0].message, /under/);
});

// ── CHB3: cast disjointness ─────────────────────────────────────────────────

test("CHB3 fires when the same invented first name is cast in two chapters", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch2.examples[0].scenario += " Maren reviews the harvest ledger at closing time.";
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint");
  assert.equal(findings.length, 2, "one finding per involved chapter");
  assert.deepEqual(findings.map((f) => f.chapterNumber).sort(), [1, 2]);
  assert.ok(findings.every((f) => f.severity === "blocker" && /"Maren"/.test(f.message)));
});

test("CHB3 does not fire when each chapter casts a different bank name", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch2.examples[0].scenario += " Sage reviews the harvest ledger at closing time.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 0);
});

test("CHB3 does not fire on a protected source-person name (packet namedCases label token)", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Gemma tapes the checklist to the cooler door.";
  ch2.examples[0].scenario += " Gemma repeats the drill with the night crew.";
  const packets = packetsFor([[1, ["Gemma Hartley emotional-labor essay"]], [2, ["Emerson Electric"]]]);
  assert.equal(only(checkReaderBudgets([ch1, ch2], { packets }), "CHB3.cast_disjoint").length, 0);
  // Control: the identical chapters WITHOUT packets treat Gemma as invented cast.
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 2);
});

test("CHB3 (no packets) treats a first name that also appears in breakdown prose as a source figure", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario += " Maren checks the tide chart before the shift begins.";
  ch1.breakdown.deepRead += " Maren's original study followed forty harbor pilots.";
  ch2.examples[0].scenario += " Maren reviews the harvest ledger at closing time.";
  ch2.breakdown.deepRead += " Maren's follow-up replicated the effect in orchards.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB3.cast_disjoint").length, 0);
});

// ── CHB4: opener signature ──────────────────────────────────────────────────

test("CHB4 fires when two first-example openers share 6 of their first 8 content tokens", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario =
    "Budget spreadsheet quarterly forecast variance printer window stapler trouble arrives before anyone has coffee.";
  // Order-shuffled, 6 of 8 shared (spreadsheet+budget+forecast+variance+printer+quarterly), 2 new.
  ch2.examples[0].scenario =
    "Forecast variance printer quarterly budget spreadsheet kettle doorway trouble arrives before anyone has coffee.";
  const findings = only(checkReaderBudgets([ch1, ch2]), "CHB4.opener_signature");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "blocker");
  assert.equal(findings[0].chapterNumber, 2, "reported on the later chapter");
});

test("CHB4 does not fire on a 5-of-8 opener overlap", () => {
  const [ch1, ch2] = cleanPair();
  ch1.examples[0].scenario =
    "Budget spreadsheet quarterly forecast variance printer window stapler trouble arrives before anyone has coffee.";
  ch2.examples[0].scenario =
    "Forecast variance printer quarterly budget kettle doorway carpet trouble arrives before anyone has coffee.";
  assert.equal(only(checkReaderBudgets([ch1, ch2]), "CHB4.opener_signature").length, 0);
});

// ── CHB5: practice format ───────────────────────────────────────────────────

test("CHB5 allows a practice-format signature in exactly 2 chapters, blocks it in 3", () => {
  const shared = "Write the budget summary before the standup meeting ends tonight.";
  const two = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  two[0].implementationPlan.twentyFourHourChallenge = shared;
  two[1].implementationPlan.twentyFourHourChallenge = shared;
  assert.equal(only(checkReaderBudgets(two), "CHB5.practice_format").length, 0, "2 repeats allowed");

  const three = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  for (const ch of three) ch.implementationPlan.twentyFourHourChallenge = shared;
  const findings = only(checkReaderBudgets(three), "CHB5.practice_format");
  assert.equal(findings.length, 3, "3 repeats block, one finding per chapter");
  assert.ok(findings.every((f) => f.severity === "blocker" && /twentyFourHourChallenge/.test(f.message)));
});

test("CHB5 tracks weeklyPractice as its own signature namespace", () => {
  const chapters = [makeChapter(BOOK, 1), makeChapter(BOOK, 2), makeChapter(BOOK, 3)];
  for (const ch of chapters) ch.implementationPlan.weeklyPractice = "Review the vendor ledger every Friday before invoices close.";
  const findings = only(checkReaderBudgets(chapters), "CHB5.practice_format");
  assert.equal(findings.length, 3);
  assert.ok(findings.every((f) => /weeklyPractice/.test(f.message)));
});

test("practiceSignature: first verb lemma + up to 3 salient nouns, function words skipped", () => {
  assert.equal(practiceSignature("Once today, write the budget summary before the standup meeting."), "write|budget+summary+standup");
  assert.equal(practiceSignature(""), null);
});

test("openerSignature: 8 stemmed content tokens after function-word removal", () => {
  const ch = makeChapter(BOOK, 1);
  ch.examples[0].scenario = "The budget spreadsheets showed a quarterly forecast variance the printers flagged during scoring reviews.";
  assert.deepEqual(openerSignature(ch), ["budget", "spreadsheet", "show", "quarterly", "forecast", "variance", "printer", "flagg"]);
});

// ── calibration helper ──────────────────────────────────────────────────────

test("calibration: two synthetic 'shipped' chapters produce zero CHB1-5 findings under their own budget", () => {
  // Mirrors the zero-FP calibration runner's packet path: shipped-quality
  // chapters + their source packets, budget defined by the book itself. Scoped
  // to CHB1-5 — the checks this fixture was built for. makeChapter deliberately
  // templates its practice fields (every chapter opens tryThisNow "Before your
  // next…", 24h "Once today,…", weekly "Each week,…"), which is exactly the
  // scaffold monoculture CHB7 prices, so CHB6-9 have their OWN calibration
  // (docs/v24/CHB6-9-calibration.md against the top-5 owner-scored corpus).
  const CHB1_5 = new Set(["CHB1.anchor_repetition", "CHB2.length_budget", "CHB3.cast_disjoint", "CHB4.opener_signature", "CHB5.practice_format"]);
  const chapters = cleanPair();
  const packets = packetsFor([[1, ["Popsicle Hotline at the Magic Castle"]], [2, ["Emerson Electric"]]]);
  const ests = chapters.map((ch) => estimatedRenderedChars(ch)).sort((a, b) => a - b);
  const budget = { renderedChars: ests[Math.floor(ests.length / 2)], tolerance: 0.2 };
  const findings = checkReaderBudgets(chapters, { packets, lengthBudget: budget }).filter((f) => CHB1_5.has(f.checkId));
  assert.deepEqual(findings, [], `expected zero CHB1-5 findings, got: ${findings.map((f) => `${f.checkId}@ch${f.chapterNumber}`).join(", ")}`);
  // The no-packets fallback on the same chapters must still produce ZERO CHB1-5
  // BLOCKERS (CHB1's title-fallback path is advisory by design).
  const fallback = checkReaderBudgets(chapters, { lengthBudget: budget }).filter((f) => CHB1_5.has(f.checkId));
  assert.equal(fallback.filter((f) => f.severity === "blocker").length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// W3 — CHB6–CHB9 (book-level backstops for the content residuals)
// ════════════════════════════════════════════════════════════════════════════

function only2(findings: BudgetFinding[], prefix: string): BudgetFinding[] {
  return findings.filter((f) => f.checkId.startsWith(prefix));
}

// A book of N chapters whose openers/scaffolds/practice are DELIBERATELY varied
// so CHB6–9 stay silent; each test then plants exactly one collision. Openers
// rotate class per chapter; scaffold fields open with a per-chapter distinct
// first-4-words family; quizzes get balanced choice lengths + no prose echo.
const WORD_ORD = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu"];
const ordWord = (n: number) => WORD_ORD[(n - 1) % WORD_ORD.length];
const OPENER_BY_CLASS: Record<string, (n: number) => string> = {
  question: (n) => `What breaks when the ${ordWord(n)} tally is copied before anyone re-reads it?`,
  scene: (n) => `At the ${ordWord(n)} loading dock, a supervisor freezes over a mismatched slip.`,
  statistic: (n) => `Seven of ten ${ordWord(n)} reopenings trace to one uncopied signature.`,
  claim: (n) => `The slow ${ordWord(n)} recheck beats the fast one because early repair stays cheap.`,
};

function variedChapter(n: number, cls: "question" | "scene" | "statistic" | "claim"): ChapterV21 {
  const ch = makeChapter(BOOK, n);
  ch.hook = OPENER_BY_CLASS[cls](n);
  // give fastRead a matching-class opener too, distinct wording per chapter.
  ch.breakdown.fastRead = OPENER_BY_CLASS[cls](n) + " " + ch.breakdown.fastRead;
  // Distinct scaffold families per chapter (different opening verbs/words).
  const verbs = ["Draft", "Audit", "Rehearse", "Schedule", "Trace", "Sketch", "Compare", "Rename", "Bundle", "Escort", "Pilot", "Anchor"];
  const v = verbs[(n - 1) % verbs.length];
  ch.tryThisNow = `${v} the ${bankWord(n, 0)} slip against yesterday, then mark one gap.`;
  ch.implementationPlan.twentyFourHourChallenge = `${v} one ${bankWord(n, 1)} record before your next handoff and note the fix.`;
  ch.implementationPlan.weeklyPractice = `${v} three ${bankWord(n, 2)} logs this cycle and log which drifted.`;
  return ch;
}

function bankWord(n: number, k: number): string {
  const B = ["harbor", "orchard", "circuit", "glacier", "sonata", "pottery", "bakery", "archive", "cannery", "foundry", "vineyard", "quarry"];
  return B[(n - 1 + k) % B.length];
}

/** N varied chapters cycling the four opener classes so no class exceeds the
 *  two-thirds cap on a small book. */
function variedBook(size: number): ChapterV21[] {
  const classes = ["question", "scene", "statistic", "claim"] as const;
  return Array.from({ length: size }, (_, i) => variedChapter(i + 1, classes[i % classes.length]));
}

// ── classifier units ────────────────────────────────────────────────────────

test("classifyOpener: question/statistic/scene/claim", () => {
  assert.equal(classifyOpener("What happens when the tally drifts?"), "question");
  assert.equal(classifyOpener("Seven of ten reopenings trace to one signature."), "statistic");
  assert.equal(classifyOpener("At the loading dock, a supervisor freezes."), "scene");
  assert.equal(classifyOpener("Maren freezes over a mismatched slip."), "scene");
  assert.equal(classifyOpener("The slow recheck beats the fast one every time."), "claim");
  assert.equal(classifyOpener(""), "claim");
});

// ── CHB6: opener-class budget ────────────────────────────────────────────────

test("CHB6 fires (advisory) when one hook opener class exceeds ceil(2/3·N)", () => {
  // 6 chapters, all claim hooks → 6 > ceil(2/3·6)=4.
  const chapters = Array.from({ length: 6 }, (_, i) => variedChapter(i + 1, "claim"));
  const findings = only2(checkReaderBudgets(chapters), "CHB6.opener_class").filter((f) => /hook/.test(f.message));
  assert.equal(findings.length, 6, "one finding per involved chapter");
  assert.ok(findings.every((f) => f.severity === "advisory"), "CHB6 ships SHADOW (advisory) — fires on top-5 owner-scored books");
  assert.match(findings[0].message, /"claim"/);
});

test("CHB6 boundary: a class at exactly ceil(2/3·N) passes; one over fires", () => {
  // N=6 → cap 4. 4 claim + 2 others = pass; 5 claim + 1 other = fire.
  const atCap = [
    variedChapter(1, "claim"), variedChapter(2, "claim"), variedChapter(3, "claim"), variedChapter(4, "claim"),
    variedChapter(5, "question"), variedChapter(6, "scene"),
  ];
  assert.equal(only2(checkReaderBudgets(atCap), "CHB6.opener_class").filter((f) => /hook/.test(f.message)).length, 0, "exactly at cap passes");
  const overCap = [
    variedChapter(1, "claim"), variedChapter(2, "claim"), variedChapter(3, "claim"), variedChapter(4, "claim"), variedChapter(5, "claim"),
    variedChapter(6, "question"),
  ];
  assert.equal(only2(checkReaderBudgets(overCap), "CHB6.opener_class").filter((f) => /hook/.test(f.message)).length, 5, "one over cap fires");
});

test("CHB6 does not fire on a rotated opener book (varied classes)", () => {
  assert.equal(only2(checkReaderBudgets(variedBook(8)), "CHB6.opener_class").length, 0);
});

// ── CHB7: scaffold family + phrase spread ────────────────────────────────────

test("scaffoldFamily: raw first-4-words, digit-folded, punctuation-stripped", () => {
  assert.equal(scaffoldFamily("In the next 24 hours, choose one routine."), "in the next #");
  assert.equal(scaffoldFamily("In the next 48 hours, pick one habit."), "in the next #", "48 folds to the same family as 24");
  assert.equal(scaffoldFamily("Within 24 hours, choose one meeting."), "within # hours choose", "a different stem is a different family");
  assert.equal(scaffoldFamily(""), null);
});

test("CHB7.scaffold_family fires (blocker) over the ceil(1/3·N) cap and is CLEAN when varied", () => {
  // 6 chapters, 5 share the "in the next #" 24h stem → 5 > ceil(1/3·6)=2.
  const chapters = variedBook(6);
  for (let i = 0; i < 5; i++) {
    chapters[i].implementationPlan.twentyFourHourChallenge = `In the next 24 hours, ${["draft", "audit", "trace", "rename", "escort"][i]} one record.`;
  }
  const fam = only2(checkReaderBudgets(chapters), "CHB7.scaffold_family").filter((f) => /twentyFourHourChallenge/.test(f.message));
  assert.equal(fam.length, 5, "one finding per colliding chapter");
  assert.ok(fam.every((f) => f.severity === "blocker"), "CHB7 is the ENFORCED (blocker) W3 check");
  assert.match(fam[0].message, /"in the next #"/);
  // Fully varied book: no CHB7 scaffold family finding.
  assert.equal(only2(checkReaderBudgets(variedBook(6)), "CHB7.scaffold_family").length, 0);
});

test("CHB7.scaffold_family boundary: exactly ceil(1/3·N) passes, one over fires", () => {
  const build = (share: number): ChapterV21[] => {
    const chapters = variedBook(6); // cap = ceil(6/3) = 2
    // share chapters open with the SAME first-4-words "once this week review".
    for (let i = 0; i < share; i++) chapters[i].implementationPlan.weeklyPractice = `Once this week review the ${bankWord(i + 1, 4)} ledger for drift.`;
    return chapters;
  };
  assert.equal(only2(checkReaderBudgets(build(2)), "CHB7.scaffold_family").filter((f) => /weeklyPractice/.test(f.message)).length, 0, "at cap passes");
  assert.equal(only2(checkReaderBudgets(build(3)), "CHB7.scaffold_family").filter((f) => /weeklyPractice/.test(f.message)).length, 3, "one over fires");
});

test("CHB7.phrase_spread fires on a non-whitelisted content 4-gram in >= 4 chapters", () => {
  const chapters = variedBook(6);
  // plant the same 4 CONTENT words (function words are dropped) in the practice
  // surface of 4 chapters: "escort mandatory quarterly reconciliation".
  for (let i = 0; i < 4; i++) {
    chapters[i].tryThisNow = `Escort mandatory quarterly reconciliation somewhere useful for ${bankWord(i + 1, 3)}.`;
  }
  const phrase = only2(checkReaderBudgets(chapters), "CHB7.phrase_spread");
  assert.ok(phrase.length >= 4, `expected a >=4-chapter phrase finding, got ${phrase.length}`);
  assert.ok(phrase.every((f) => f.severity === "blocker"));
  assert.match(phrase[0].message, /escort mandatory quarterly reconciliation/);
});

test("CHB7.phrase_spread whitelist: a 4-gram of the book's own terms of art (title/example titles) is exempt", () => {
  const chapters = variedBook(6);
  // Make the repeated 4-gram entirely the book's terms of art: put the words in
  // each chapter's TITLE and in the practice surface. Title tokens are whitelisted.
  for (let i = 0; i < 5; i++) {
    chapters[i].title = "Peak Pit Transition Signing";
    chapters[i].tryThisNow = `Peak pit transition signing matters here ${i}.`;
  }
  const phrase = only2(checkReaderBudgets(chapters), "CHB7.phrase_spread").filter((f) => /peak pit transition signing/.test(f.message));
  assert.equal(phrase.length, 0, "a 4-gram built entirely from the book's own title tokens is whitelisted");
});

// ── CHB8: tell-distribution bands ─────────────────────────────────────────────

/** Rebuild a chapter's quiz to a controlled tell profile: for each question,
 *  the key is either uniquely shortest, uniquely longest, echoes prose, or is
 *  balanced. */
function setQuizTells(ch: ChapterV21, mode: "shortest" | "balanced" | "longest"): ChapterV21 {
  ch.quiz.questions = ch.quiz.questions.map((q, i) => {
    if (mode === "shortest") {
      return { ...q, choices: ["Stop.", "Trace the divergent ledger entry across three prior handoffs carefully.", "Average the two figures and defer the reconciliation until the retro."], correctIndex: 0 };
    }
    if (mode === "longest") {
      return { ...q, choices: ["Wait.", "Skip it.", "Trace the earliest divergent ledger entry across three prior handoffs before acting."], correctIndex: 2 };
    }
    // balanced: three similar-length, distinct choices; key rotates.
    return { ...q, choices: [`Recheck the ${bankWord(i + 1, 0)} entry against the prior day.`, `Freeze new ${bankWord(i + 1, 1)} work until the divergence is located.`, `Ask the ${bankWord(i + 1, 2)} owner to confirm from memory and move on.`], correctIndex: i % 3 };
  });
  return ch;
}

test("CHB8.shortest_band fires (advisory) when key is uniquely shortest well over 45%", () => {
  const chapters = variedBook(4).map((ch) => setQuizTells(ch, "shortest"));
  const f = only2(checkReaderBudgets(chapters), "CHB8.shortest_band");
  assert.equal(f.length, 1, "one book-level finding");
  assert.equal(f[0].severity, "advisory");
  assert.match(f[0].message, /shortest/);
});

test("CHB8.shortest_band ALSO fires below the 20% floor (symmetric band)", () => {
  const chapters = variedBook(4).map((ch) => setQuizTells(ch, "longest"));
  const shortest = only2(checkReaderBudgets(chapters), "CHB8.shortest_band");
  assert.equal(shortest.length, 1, "0% shortest is below the 20% floor — the band is two-sided");
  const longest = only2(checkReaderBudgets(chapters), "CHB8.longest_band");
  assert.equal(longest.length, 1, "key uniquely longest 100% > 40% cap");
});

test("CHB8 bands are SILENT on a balanced quiz book", () => {
  const chapters = variedBook(6).map((ch) => setQuizTells(ch, "balanced"));
  assert.equal(only2(checkReaderBudgets(chapters), "CHB8.longest_band").length, 0);
  assert.equal(only2(checkReaderBudgets(chapters), "CHB8.echo_band").length, 0);
});

test("CHB8.case_stem_band fires when > 30% of stems name their own chapter's case verbatim (packet path)", () => {
  const chapters = variedBook(4).map((ch) => setQuizTells(ch, "balanced"));
  const caseTok = ["Popsicle", "Emerson", "Kodak", "Deere"];
  // each chapter's stems name ITS OWN case token → 100% case-anchored.
  chapters.forEach((ch, ci) => {
    ch.quiz.questions = ch.quiz.questions.map((q) => ({ ...q, prompt: `How does the ${caseTok[ci]} protocol change the ${q.prompt}` }));
  });
  const packets = packetsFor([[1, ["Popsicle Hotline"]], [2, ["Emerson Electric"]], [3, ["Kodak Archive"]], [4, ["Deere Line"]]]);
  const f = only2(checkReaderBudgets(chapters, { packets }), "CHB8.case_stem_band");
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "advisory");
  assert.match(f[0].message, /stems name a chapter case/);
  // Control: with NO case-anchored stems (balanced default prompts), it stays silent.
  const clean = variedBook(4).map((ch) => setQuizTells(ch, "balanced"));
  assert.equal(only2(checkReaderBudgets(clean, { packets }), "CHB8.case_stem_band").length, 0);
});

test("CHB8.case_stem_band (loose shape) derives case names from example titles when no packets", () => {
  const chapters = variedBook(4).map((ch) => setQuizTells(ch, "balanced"));
  for (const ch of chapters) {
    ch.examples[0].title = "Bramwell Foundry audit"; // "Bramwell" becomes a derived case name
    ch.quiz.questions = ch.quiz.questions.map((q) => ({ ...q, prompt: `In the Bramwell case, ${q.prompt}` }));
  }
  const f = only2(checkReaderBudgets(chapters), "CHB8.case_stem_band");
  assert.equal(f.length, 1, "text-derived proper-noun case names drive the stem measure on loose chapters");
});

// ── CHB9: practice budgets ────────────────────────────────────────────────────

test("hasOptionMenu / hasQuotedScript unit behavior", () => {
  assert.equal(hasOptionMenu("Add a thank-you line, a clean handoff, or a last easy step."), true);
  assert.equal(hasOptionMenu("Draft one line and mark the gap."), false);
  assert.equal(hasQuotedScript('Say: "What did the last miss teach me to change?" then edit.'), true);
  assert.equal(hasQuotedScript("Say the sentence you rehearsed out loud."), false);
});

test("CHB9.option_menu fires (advisory) when > 15% of practice items are a/b/or-c menus", () => {
  const chapters = variedBook(4);
  // make every 24h challenge a 3-option menu → 4/ (4*3 base items) well over 15%.
  for (const ch of chapters) ch.implementationPlan.twentyFourHourChallenge = "Add a thank-you note, a clean handoff, or a last easy step.";
  const f = only2(checkReaderBudgets(chapters), "CHB9.option_menu");
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "advisory");
  assert.match(f[0].message, /option menus/);
});

test("CHB9.option_menu silent when menus stay under the 15% cap", () => {
  const chapters = variedBook(8); // varied practice, no menus
  assert.equal(only2(checkReaderBudgets(chapters), "CHB9.option_menu").length, 0);
});

test("CHB9.quoted_script fires (advisory) when fewer than 3 chapters carry a quoted say-aloud script", () => {
  const chapters = variedBook(6); // none carry a quoted script
  const f = only2(checkReaderBudgets(chapters), "CHB9.quoted_script");
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "advisory");
  assert.match(f[0].message, /quoted say-aloud script/);
});

test("CHB9.quoted_script silent once >= 3 chapters carry a quoted script", () => {
  const chapters = variedBook(6);
  for (let i = 0; i < 3; i++) chapters[i].tryThisNow = `Say out loud: "I will not pass a value I cannot connect to evidence." Then continue.`;
  assert.equal(only2(checkReaderBudgets(chapters), "CHB9.quoted_script").length, 0);
});

// ── dual-shape (slim strings vs legacy MaybeToned) ───────────────────────────

test("asText resolves plain strings AND MaybeToned {direct}; CHB checks read both shapes", () => {
  assert.equal(asText("plain"), "plain");
  assert.equal(asText({ direct: "toned", warm: "x", competitive: "y" }), "toned");
  assert.equal(asText(undefined), "");
  // A legacy MaybeToned scenario/challenge is read the same as a slim string.
  const chapters = variedBook(6);
  for (let i = 0; i < 5; i++) {
    // legacy shape: challenge as a toned triple sharing the "in the next #" stem.
    (chapters[i].implementationPlan as unknown as { twentyFourHourChallenge: unknown }).twentyFourHourChallenge = {
      direct: `In the next 24 hours, ${["draft", "audit", "trace", "rename", "escort"][i]} one record.`, warm: "w", competitive: "c",
    };
  }
  const fam = only2(checkReaderBudgets(chapters), "CHB7.scaffold_family").filter((f) => /twentyFourHourChallenge/.test(f.message));
  assert.equal(fam.length, 5, "MaybeToned challenge fields feed CHB7 exactly like plain strings");
});

test("quizViews reads slim string choices and skips malformed questions", () => {
  const ch = makeChapter(BOOK, 1);
  const views = quizViews(ch);
  assert.equal(views.length, ch.quiz.questions.length);
  assert.ok(views.every((v) => v.choices.length === 3));
  // a malformed question (out-of-range key) is skipped, not thrown on.
  ch.quiz.questions[0] = { ...ch.quiz.questions[0], correctIndex: 9 };
  assert.equal(quizViews(ch).length, ch.quiz.questions.length - 1);
});

// ── report format parity with CHB1-5 ─────────────────────────────────────────

test("CHB6-9 findings carry the same shape as CHB1-5 (checkId/severity/chapterNumber/message)", () => {
  const chapters = variedBook(6);
  for (let i = 0; i < 5; i++) chapters[i].implementationPlan.twentyFourHourChallenge = `In the next 24 hours, ${["draft", "audit", "trace", "rename", "escort"][i]} one record.`;
  const findings = only2(checkReaderBudgets(chapters), "CHB7");
  assert.ok(findings.length > 0);
  for (const f of findings) {
    assert.equal(typeof f.checkId, "string");
    assert.ok(f.severity === "blocker" || f.severity === "advisory");
    assert.equal(typeof f.chapterNumber, "number");
    assert.ok(f.message.length > 0);
  }
});
