/**
 * Repair lane (plan docs/v24/REPAIR-LANE-PLAN-2026-07-04.md, grilled r1) —
 * scope-level complaint convergence, fail-closed vetoes, remedy stripping,
 * patch-apply splicing, repair card pins, and the lineage-keyed repair cap.
 * Complaint fixtures are the REAL must-fix texts from the 2026-07-04 run.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import {
  REPAIR_COMPOSITE_FLOOR,
  buildRepairCard,
  classifyRepairEligibility,
  deriveComplaintScope,
  reviewRepairEnabled,
  spliceRepairScopes,
  stripRemedyClauses,
} from "../src/orchestrator/authorRepair.js";
import {
  loadAuthorRegenLedger,
  recordRegenConsumed,
  recordRepairConsumed,
  regenConsumedFor,
  repairConsumedFor,
} from "../src/orchestrator/authorRegenLedger.js";

const BOOK = "zz-fixture-repair";

// Real complaint texts from the 2026-07-04 execution run.
const Q2_SOUTHWEST = "quiz Q2: The correct answer repeats the exact Southwest list from the prose, while the other options are shorter and vaguer.";
const DISTRACTORS_PLAIN = "quiz overall: Several distractors are too plainly wrong or unethical, making the correct option guessable without reading the chapter closely.";
const HOOK_PROSE = "The hook is under-explained; the cast friction in the opening reads abrupt.";
const SCAFFOLD = "The invented names in the examples feel like scaffold — generic stand-ins rather than people.";

test("classifier: leaf-divergent but scope-convergent quiz complaints are ELIGIBLE (the ch05 texture)", () => {
  const r = classifyRepairEligibility(
    [[Q2_SOUTHWEST], [DISTRACTORS_PLAIN], ["quiz Q6: two distractors are near-duplicates of each other."]],
    [84.9, 83.7, 83.8],
  );
  assert.equal(r.eligible, true, r.reason);
  assert.deepEqual(r.scopes, ["quiz"]);
});

test("classifier: fail-closed vetoes — prose, quality adjectives, count changes, unclassifiable, diffuse", () => {
  // Prose target (the ch09 texture) → regen.
  assert.equal(classifyRepairEligibility([[Q2_SOUTHWEST], [HOOK_PROSE]], [85, 86]).eligible, false);
  // Quality adjective on a field = prose symptom in field clothing → regen.
  assert.equal(classifyRepairEligibility([[SCAFFOLD], [SCAFFOLD]], [85, 86]).eligible, false);
  // Count change violates the dealt-count contract → regen.
  assert.equal(classifyRepairEligibility([["cut example 5 and merge it into example 2"], ["remove one example"]], [85, 86]).eligible, false);
  // Unclassifiable → regen.
  assert.equal(classifyRepairEligibility([["the chapter felt off to me"], [Q2_SOUTHWEST]], [85, 86]).eligible, false);
  // Only one read carries complaints → no convergence evidence → regen.
  assert.equal(classifyRepairEligibility([[Q2_SOUTHWEST], []], [85, 86]).eligible, false);
  // Divergent scopes with no >=2 agreement → regen.
  assert.equal(classifyRepairEligibility([[Q2_SOUTHWEST], ["the memorable lines overlap each other"]], [85, 86]).eligible, false);
  // Outlier scope beyond the convergent set → regen (a repair would skip a named defect).
  assert.equal(classifyRepairEligibility([[Q2_SOUTHWEST, "example 3's whatToDo is vague on the first step"], [DISTRACTORS_PLAIN]], [85, 86]).eligible, false);
  // Median below the floor → regen.
  assert.equal(classifyRepairEligibility([[Q2_SOUTHWEST], [DISTRACTORS_PLAIN]], [REPAIR_COMPOSITE_FLOOR - 1, REPAIR_COMPOSITE_FLOOR - 2]).eligible, false);
});

test("classifier: scope derivation — indexed examples repairable, unindexed veto; kill switch env", () => {
  assert.equal(deriveComplaintScope("example 3's whyItMatters restates the scenario"), "examples[2]");
  assert.equal(deriveComplaintScope("the examples all feel similar"), "VETO", "unindexed example surface is too wide");
  assert.equal(deriveComplaintScope("quiz Q4: key echoes the prose"), "quiz");
  assert.equal(deriveComplaintScope("the 24-hour challenge lacks a concrete number"), "practice");
  const prev = process.env.CHAPTERFLOW_REVIEW_REPAIR;
  try {
    process.env.CHAPTERFLOW_REVIEW_REPAIR = "0";
    assert.equal(reviewRepairEnabled(), false);
    delete process.env.CHAPTERFLOW_REVIEW_REPAIR;
    assert.equal(reviewRepairEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_REVIEW_REPAIR; else process.env.CHAPTERFLOW_REVIEW_REPAIR = prev;
  }
});

test("stripRemedyClauses: prescriptions drop, defect statements and enumerations survive", () => {
  const stripped = stripRemedyClauses("The key is the only option naming a return date. Fix it by shortening the key.");
  assert.ok(stripped.includes("only option naming a return date"), "defect kept");
  assert.ok(!/shortening the key/i.test(stripped), "prescription dropped");
  const enumKept = stripRemedyClauses("Q1 is not derivable: the chapter teaches cadence, owners, and follow-up, but the key asserts a quota rule.");
  assert.ok(enumKept.includes("teaches cadence, owners, and follow-up"), "evidence enumeration kept");
});

test("splice: only allowed scopes cross; out-of-scope drift is discarded by construction; count changes throw", () => {
  const original = makeChapter(BOOK, 3);
  const repaired: typeof original = JSON.parse(JSON.stringify(original));
  repaired.quiz.questions[1].choices = repaired.quiz.questions[1].choices.map((c, i) => (i === 0 ? c : `${c} (rebalanced)`));
  repaired.hook = "A COMPLETELY REWRITTEN HOOK THE EDITOR HAD NO BUSINESS TOUCHING";
  repaired.breakdown.fastRead = "drive-by prose edit";
  const spliced = spliceRepairScopes(original, repaired, ["quiz"]);
  assert.equal(spliced.hook, original.hook, "out-of-scope hook edit discarded");
  assert.equal(spliced.breakdown.fastRead, original.breakdown.fastRead, "out-of-scope prose edit discarded");
  assert.ok(spliced.quiz.questions[1].choices[1].endsWith("(rebalanced)"), "in-scope quiz edit applied");
  // Count change inside scope → structural throw.
  const shrunk: typeof original = JSON.parse(JSON.stringify(repaired));
  shrunk.quiz.questions = shrunk.quiz.questions.slice(0, 8);
  assert.throws(() => spliceRepairScopes(original, shrunk, ["quiz"]), /question count/);
  const fewerExamples: typeof original = JSON.parse(JSON.stringify(original));
  fewerExamples.examples = fewerExamples.examples.slice(0, fewerExamples.examples.length - 1);
  assert.throws(() => spliceRepairScopes(original, fewerExamples, ["examples[0]"]), /example count/);
  // examples[i] scope carries exactly that example.
  const exEdit: typeof original = JSON.parse(JSON.stringify(original));
  exEdit.examples[2] = { ...exEdit.examples[2], whyItMatters: "Because the miss shows up on the board before it shows up in the numbers." };
  exEdit.examples[0] = { ...exEdit.examples[0], whyItMatters: "OUT OF SCOPE EDIT" };
  const exSpliced = spliceRepairScopes(original, exEdit, ["examples[2]"]);
  assert.equal(exSpliced.examples[2].whyItMatters, exEdit.examples[2].whyItMatters, "scoped example applied");
  assert.equal(exSpliced.examples[0].whyItMatters, original.examples[0].whyItMatters, "unscoped example untouched");
});

test("repair card: surgical role, scope contract, anti-echo, dealt quiz caps, measured evidence", () => {
  const chapter = makeChapter(BOOK, 5);
  const card = buildRepairCard({
    bookId: BOOK,
    chapter,
    brief: {
      quizStemShapes: ["spot-the-violation", "best-explanation-why", "ordering-priority", "transfer-new-domain"],
      quizFailureModes: ["half-measure", "over-correction", "right-move-wrong-trigger", "borrowed-authority"],
      questionFactOrder: [9, 5, 4, 8, 3, 6, 7, 2, 1],
    } as never,
    complaints: [Q2_SOUTHWEST, DISTRACTORS_PLAIN],
    scopes: ["quiz"],
    relPath: "state/chapters/zz-fixture-repair-ch05.v21-native.chapter.json",
  });
  assert.ok(card.includes("surgical editor, NOT an author"), "role framed as editor");
  assert.ok(card.includes("ALLOWED SCOPE"), "scope contract present");
  assert.ok(card.includes("Never reuse a reviewer's phrasing"), "anti-echo rule");
  assert.ok(card.includes("at most ONE of the 9 questions and uniquely SHORTEST in at most FOUR"), "hard length caps stated");
  assert.ok(card.includes("MEASURED QUIZ EVIDENCE"), "char-count evidence attached");
  assert.ok(card.includes("Never change the NUMBER"), "count preservation rule");
  assert.ok(!/gate weakening|confirm the fix/i.test(card), "sanity");
});

test("ledger: repair cap is lineage-keyed, independent of the regen counter, absent-map tolerant", () => {
  const root = mkdtempSync(join(tmpdir(), "repair-ledger-"));
  try {
    const lineage = "abc123def456";
    assert.equal(repairConsumedFor(loadAuthorRegenLedger(BOOK, root), 4, lineage), 0, "pre-lane ledgers read as 0");
    recordRepairConsumed(BOOK, 4, lineage, root);
    const after = loadAuthorRegenLedger(BOOK, root);
    assert.equal(repairConsumedFor(after, 4, lineage), 1);
    assert.equal(regenConsumedFor(after, 4, lineage), 0, "repair does not touch the regen budget");
    recordRegenConsumed(BOOK, 4, lineage, root);
    const both = loadAuthorRegenLedger(BOOK, root);
    assert.equal(repairConsumedFor(both, 4, lineage), 1);
    assert.equal(regenConsumedFor(both, 4, lineage), 1);
    assert.equal(repairConsumedFor(both, 4, "otherlineage1"), 0, "a re-dealt lineage reads fresh (C1 contract)");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("F4: budget-repair writes consume a lineage-keyed durable counter, independent of regen and repair", async () => {
  const { budgetRepairConsumedFor, recordBudgetRepairConsumed } = await import("../src/orchestrator/authorRegenLedger.js");
  const root = mkdtempSync(join(tmpdir(), "budget-repair-ledger-"));
  try {
    const lineage = "abc123def456";
    assert.equal(budgetRepairConsumedFor(loadAuthorRegenLedger(BOOK, root), 4, lineage), 0, "pre-F4 ledgers read as 0 (additive schema)");
    recordBudgetRepairConsumed(BOOK, 4, lineage, root);
    const after = loadAuthorRegenLedger(BOOK, root);
    assert.equal(budgetRepairConsumedFor(after, 4, lineage), 1);
    assert.equal(regenConsumedFor(after, 4, lineage), 0, "budget repair does not touch the regen budget");
    assert.equal(repairConsumedFor(after, 4, lineage), 0, "…nor the surgical-repair budget");
    assert.equal(budgetRepairConsumedFor(after, 4, "otherlineage1"), 0, "a re-dealt lineage reads fresh (C1 contract)");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("book-sameness repair: writes consume a SEPARATE bounded lineage-keyed lane, never touching regen/repair/budget", async () => {
  const { samenessRepairConsumedFor, recordSamenessRepairConsumed, budgetRepairConsumedFor } = await import("../src/orchestrator/authorRegenLedger.js");
  const root = mkdtempSync(join(tmpdir(), "sameness-repair-ledger-"));
  try {
    const lineage = "abc123def456";
    assert.equal(samenessRepairConsumedFor(loadAuthorRegenLedger(BOOK, root), 3, lineage), 0, "pre-lane ledgers read as 0 (additive)");
    recordSamenessRepairConsumed(BOOK, 3, lineage, root);
    const after = loadAuthorRegenLedger(BOOK, root);
    assert.equal(samenessRepairConsumedFor(after, 3, lineage), 1, "one grant recorded");
    // Bounded + independent: never touches the other three lanes.
    assert.equal(regenConsumedFor(after, 3, lineage), 0, "sameness repair does not touch the regen budget (prior evidence preserved)");
    assert.equal(repairConsumedFor(after, 3, lineage), 0, "…nor the surgical-repair budget");
    assert.equal(budgetRepairConsumedFor(after, 3, lineage), 0, "…nor the budget-repair budget");
    // A different lineage (re-deal) reads fresh; another chapter is independent.
    assert.equal(samenessRepairConsumedFor(after, 3, "otherlineage1"), 0, "a re-dealt lineage reads fresh");
    assert.equal(samenessRepairConsumedFor(after, 9, lineage), 0, "another chapter is independent");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("content-deal repair: consumes its OWN lane, independent of the architecture sameness lane", async () => {
  const {
    contentRepairConsumedFor, recordContentRepairConsumed, resetContentRepairConsumed,
    samenessRepairConsumedFor, recordSamenessRepairConsumed,
  } = await import("../src/orchestrator/authorRegenLedger.js");
  const root = mkdtempSync(join(tmpdir(), "content-repair-ledger-"));
  try {
    const lineage = "c0ntent1a2b3c";
    // A chapter that ALREADY spent its architecture-diversification grant…
    recordSamenessRepairConsumed(BOOK, 3, lineage, root);
    // …can still receive ONE content-deal repair (the collision this lane fixes).
    assert.equal(contentRepairConsumedFor(loadAuthorRegenLedger(BOOK, root), 3, lineage), 0, "content lane starts fresh even after a sameness grant");
    recordContentRepairConsumed(BOOK, 3, lineage, root);
    const after = loadAuthorRegenLedger(BOOK, root);
    assert.equal(contentRepairConsumedFor(after, 3, lineage), 1, "content grant recorded");
    assert.equal(samenessRepairConsumedFor(after, 3, lineage), 1, "the architecture grant is untouched (both lanes coexist)");
    assert.equal(regenConsumedFor(after, 3, lineage), 0, "content repair never touches regen evidence");
    // Controlled reset grants exactly one fresh attempt.
    resetContentRepairConsumed(BOOK, 3, lineage, root);
    assert.equal(contentRepairConsumedFor(loadAuthorRegenLedger(BOOK, root), 3, lineage), 0, "reset clears the content grant for one controlled retry");
    assert.equal(samenessRepairConsumedFor(loadAuthorRegenLedger(BOOK, root), 3, lineage), 1, "resetting content never touches the sameness lane");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("W1: duplicated field labels complain at write time (the ch08 0-3 class)", async () => {
  const { authorWriteContractFindings } = await import("../src/orchestrator/authorRun.js");
  const chapter = makeChapter(BOOK, 2);
  chapter.examples[4] = { ...chapter.examples[4], whyItMatters: "Why it matters: the promise decays without a return point." };
  const brief = { rotationSchemaVersion: "brief-rotation-v3", exampleCount: chapter.examples.length } as never;
  const packet = { facts: [], allowedNumbers: [] } as never;
  const found = authorWriteContractFindings(chapter, brief, packet).filter((c) => c.startsWith("duplicated label"));
  assert.equal(found.length, 1, "label duplication caught");
  assert.ok(found[0].includes("examples[5].whyItMatters"));
  chapter.examples[4] = { ...chapter.examples[4], whyItMatters: "The promise decays without a return point." };
  assert.equal(authorWriteContractFindings(chapter, brief, packet).filter((c) => c.startsWith("duplicated label")).length, 0, "clean text passes");
  // CROSS-label collision (the live ch07 artifact that flipped the book gate
  // 0P/3F): "Why it works:" leaking into whatToDo.
  chapter.examples[1] = { ...chapter.examples[1], whatToDo: "Why it works: the customer pain forces the inside model into view." };
  const cross = authorWriteContractFindings(chapter, brief, packet).filter((c) => c.startsWith("duplicated label"));
  assert.equal(cross.length, 1, "cross-label leak caught");
  assert.ok(cross[0].includes("examples[2].whatToDo"));
});

test("CHB2 routing: an over-ceiling length blocker routes a targeted trim complaint to ITS chapter (STIER-3 live halt)", async () => {
  const { buildBudgetRepairComplaints } = await import("../src/critics/readerBudgets.js");
  const chapters = [1, 2, 3].map((n) => makeChapter(BOOK, n));
  const finding = {
    checkId: "CHB2.length_budget",
    severity: "blocker",
    chapterNumber: 1,
    message: "ch01 estimated rendered length 19509 chars is 22% over the 16000-char budget (allowed window 12800–19200); readers rejected ~40% inflation.",
  } as never;
  const routed = buildBudgetRepairComplaints(chapters, [finding]);
  const lines = routed.get(1) ?? [];
  assert.equal(lines.length, 1, "routes to ch01");
  assert.ok(lines[0].includes("Land the chapter at 18400\u201318900 chars"), `landing zone computed from the window: ${lines[0]}`);
  assert.ok(lines[0].includes("never touch the quiz keys"), "trim guardrails present");
  assert.equal((routed.get(2) ?? []).length + (routed.get(3) ?? []).length, 0, "no bleed to other chapters");
});

test("CHB1 routing: anchor-hammering blockers route a per-chapter cut complaint (start-with-why live halt)", async () => {
  const { buildBudgetRepairComplaints } = await import("../src/critics/readerBudgets.js");
  const chapters = [1, 4, 6].map((n) => makeChapter(BOOK, n));
  const findings = [
    { checkId: "CHB1.anchor_repetition", severity: "blocker", chapterNumber: 1, message: 'ch01 reading surface mentions "detroit" (distinctive token of case "Detroit automakers") 9 times — over the per-chapter cap of 6; readers flagged anchor hammering. Vary the reference or cut mentions.' },
    { checkId: "CHB1.anchor_repetition", severity: "blocker", chapterNumber: 4, message: 'ch04 reading surface mentions "neocortex" (distinctive token of case "Neocortex") 8 times — over the per-chapter cap of 6; readers flagged anchor hammering. Vary the reference or cut mentions.' },
  ] as never[];
  const routed = buildBudgetRepairComplaints(chapters, findings);
  assert.deepEqual([...routed.keys()].sort((a, b) => a - b), [1, 4], "routes each flagged chapter, no bleed");
  const ch1 = (routed.get(1) ?? [])[0] ?? "";
  assert.ok(ch1.includes('"detroit"') && ch1.includes("AT MOST 6"), `names the exact token + the cap: ${ch1}`);
  assert.ok(ch1.includes("Keep every fact") && ch1.includes("do not touch the quiz keys".replace("do", "Do")), "substance + structure guardrails present");
  assert.equal((routed.get(6) ?? []).length, 0, "an un-flagged chapter gets no complaint");
});
