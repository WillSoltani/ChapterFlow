/**
 * S-tier levers (plan docs/v24/STIER-PLAN-2026-07-03.md) — the prevention deals
 * (P2/P4/P1: example-lens triples, practice-verb registers, framework-noun
 * budgets, dealt friction examples), the detection budgets (D1–D4: CHB10–13),
 * the lineage-keyed regen ledger (C1, incl. the v1 migration), the near-bar
 * tiebreak (C3 — including the adversarial round-2 #1 regression: a majority
 * verdict owns the latest-pointer; a lone losing PASS can never mint a carry),
 * and the acceptance-sample salt/force-include (C4).
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import type { ChapterV21 } from "../src/types.js";
import {
  EXAMPLE_LENSES,
  PRACTICE_VERBS,
  ROTATION_SCHEMA_VERSION,
  dealBriefRotations,
  dealFrictionFlags,
  dealLensTriples,
  twoThirdsCap,
} from "../src/compiler/briefRotation.js";
import { briefVarietyInstructionLines, hotFrameworkNouns } from "../src/compiler/chapterBrief.js";
import { writerPacketProjection } from "../src/compiler/sourcePacketProjection.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { chapterBriefPath, sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import {
  AUTHOR_PREMIUM_BLOCK,
  AUTHOR_QUALITY_BAR,
  buildAuthorCard,
} from "../src/orchestrator/authorRun.js";
import {
  CHB10_BAND_BLOCKER,
  buildBudgetRepairComplaints,
  buildChurnEvidenceReport,
  checkReaderBudgets,
  rankSaturationContributors,
  type BudgetFinding,
} from "../src/critics/readerBudgets.js";
import {
  RegenLedgerError,
  authorRegenLedgerPath,
  computeRegenLineage,
  loadAuthorRegenLedger,
  migrateLegacyRegenCounts,
  recordRegenConsumed,
  regenConsumedFor,
} from "../src/orchestrator/authorRegenLedger.js";
import { selectAcceptanceSample, selectSeededIdxs } from "../src/review/evalBookProxy.js";
import {
  AUTHOR_BOOK_READERS,
  complaintNamesReservedHarm,
  doAuthorReview,
  isFlipSignature,
  isNearBar,
  mapNamedBookComplaints,
  type AuthorReviewIo,
} from "../src/orchestrator/authorReview.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { REVIEW_FACTORS, type ChapterReviewV1 } from "../src/artifacts/artifactTypes.js";
import { loadTiebreakNotes, reviewDir } from "../src/orchestrator/authorReviewLedger.js";

const BOOK = "zz-fixture-stier";

// ── P2: example-lens triples ───────────────────────────────────────────────────

test("P2: dealLensTriples — 3 DISTINCT lenses per chapter, per-lens 2/3 cap, deterministic", () => {
  for (const n of [4, 9, 12, 20]) {
    const a = dealLensTriples("some-book", n);
    const b = dealLensTriples("some-book", n);
    assert.deepEqual(a, b, `deterministic for n=${n}`);
    assert.equal(a.length, n);
    const counts = new Map<string, number>();
    for (const triple of a) {
      assert.equal(triple.length, 3, "three lenses each");
      assert.equal(new Set(triple).size, 3, "no intra-chapter duplicate (#13)");
      for (const lens of triple) {
        assert.ok((EXAMPLE_LENSES as readonly string[]).includes(lens));
        counts.set(lens, (counts.get(lens) ?? 0) + 1);
      }
    }
    for (const [lens, count] of counts) {
      assert.ok(count <= twoThirdsCap(n), `${lens} on ${count}/${n} chapters exceeds the 2/3 cap`);
    }
  }
  assert.notDeepEqual(dealLensTriples("book-a", 9), dealLensTriples("book-b", 9), "per-book rotation differs");
});

test("P2 #14: dealFrictionFlags — all but min(3, floor(N/3)) chapters marked; any 4-sample sees a marked chapter", () => {
  for (const n of [4, 9, 10, 12, 20]) {
    const flags = dealFrictionFlags("some-book", n);
    assert.equal(flags.length, n);
    const unmarked = flags.filter((f) => !f).length;
    assert.equal(unmarked, Math.min(3, Math.floor(n / 3)), `n=${n} unmarked count`);
    assert.ok(unmarked < 4, "any 4-chapter acceptance sample must contain a marked chapter");
    assert.deepEqual(flags, dealFrictionFlags("some-book", n), "deterministic");
  }
});

test("P4: practiceVerb dealt no-repeat while N ≤ pool; rotation carries all five dealt fields", () => {
  const rot = dealBriefRotations("some-book", 9);
  const verbs = [...rot.values()].map((r) => r.practiceVerb);
  assert.equal(new Set(verbs).size, 9, "9 chapters ≤ 10 verbs → no repeat");
  for (const r of rot.values()) {
    assert.ok((PRACTICE_VERBS as readonly string[]).includes(r.practiceVerb));
    assert.equal(r.exampleLenses.length, 3);
    assert.equal(typeof r.requireFrictionExample, "boolean");
  }
});

// ── P1: framework-noun budget ──────────────────────────────────────────────────

function mkPacket(n: number, claims: string[]): SourcePacketV1 {
  return {
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    facts: claims.map((claim, i) => ({ id: `ch${n}.fact.${i}`, claim, groundedEntities: [], groundedNumbers: [], groundedPlaces: [] })),
    namedCases: [],
    allowedAnchors: [],
    allowedEntities: [],
    allowedNumbers: [],
    allowedPlaces: [],
  } as unknown as SourcePacketV1;
}

test("P1: hotFrameworkNouns ranks by packet spread from FACT TEXT only, stoplists generics, deterministic", () => {
  const packets = [1, 2, 3, 4].map((n) =>
    mkPacket(n, [
      `The accountability cadence makes every promise visible to people`, // 'accountability'/'cadence'/'promise' everywhere
      `A cadence review ties the promise to work that people can check`,
    ]));
  const nouns = hotFrameworkNouns(packets);
  assert.ok(nouns.includes("cadence"), `cadence in ${nouns}`);
  assert.ok(nouns.includes("promise"), `promise in ${nouns}`);
  assert.ok(!nouns.includes("people"), "generic 'people' stoplisted");
  assert.ok(!nouns.includes("work"), "generic 'work' stoplisted");
  assert.deepEqual(nouns, hotFrameworkNouns(packets), "deterministic");
  // A noun in only 1/4 packets is below the majority-spread floor.
  const skewed = [...packets.slice(0, 3), mkPacket(4, ["The flywheel spins alone here, flywheel flywheel flywheel"])];
  assert.ok(!hotFrameworkNouns(skewed).includes("flywheel"), "single-packet noun excluded by spread");
});

test("P1/P2/P4: briefVarietyInstructionLines renders the new dealt lines; legacy briefs render the original three (compat)", () => {
  const base = {
    openerType: "scene", challengeFrame: "audit-one-artifact", practiceShape: "two-step-sequence",
  } as ChapterBriefV1;
  const legacy = briefVarietyInstructionLines(base);
  assert.equal(legacy.length, 3, "legacy brief → exactly the original three lines");
  const full = briefVarietyInstructionLines({
    ...base,
    exampleLenses: ["dialogue-beat", "postmortem", "before-after-ledger"],
    practiceVerb: "circle",
    requireFrictionExample: true,
    frameworkNouns: ["cadence", "promise"],
  } as ChapterBriefV1);
  const text = full.join("\n");
  assert.ok(text.includes("EXAMPLE SCENES"), "lens block present");
  assert.ok(text.includes("failing or only partially working"), "dealt friction requirement present");
  assert.ok(text.includes("dialogue-beat:"), "per-lens instruction rendered");
  assert.ok(text.includes("never given invented quotes"), "dialogue fabrication guardrail shipped (#15)");
  assert.ok(text.includes('around "circle"'), "practice verb dealt");
  assert.ok(text.includes("FRAMEWORK VOCABULARY BUDGET"), "vocabulary budget present");
  assert.ok(text.includes("cadence, promise"), "hot nouns listed");
  assert.ok(text.includes("owner, leader, manager"), "emergent role-noun rule present (#12)");
  const noFriction = briefVarietyInstructionLines({
    ...base,
    exampleLenses: ["dialogue-beat", "postmortem", "before-after-ledger"],
    requireFrictionExample: false,
  } as ChapterBriefV1);
  assert.ok(!noFriction.join("\n").includes("failing or only partially working"), "#14: friction requirement only when dealt");
});

// ── P3/P5/P7: the card ─────────────────────────────────────────────────────────

test("P3/P5/P7: QUALITY BAR rule 5 + band protocol + stem ban; PREMIUM block and sharedSpine line ride the card", () => {
  // STIER-2 rebase (documented, plan §B P12): rule 5 became the TRANSFORM recipe —
  // key-first, dealt failure modes, echo symmetry. The scan-only version just moved
  // the wrongness monoculture to the next lexicon (all 5 halted-run tiebreaks led
  // with quiz-tell must-fixes).
  assert.ok(AUTHOR_QUALITY_BAR.includes("5. DISTRACTOR TRANSFORM"), "rule 5 exists (transform recipe)");
  assert.ok(AUTHOR_QUALITY_BAR.includes("TRANSFORM it"), "key-first transform derivation named");
  assert.ok(AUTHOR_QUALITY_BAR.includes("ECHO SYMMETRY"), "echo symmetry named");
  assert.ok(AUTHOR_QUALITY_BAR.includes("NEVER a fixed stem"), "#16 explanation-stem ban");
  // B12+B14 rebase (STIER-2 rerun rounds 1-3, documented): "longest in at most 3"
  // CONTRADICTED the binding tellRate gate (≤0.2 → at most ONE uniquely-longest key
  // per 9); the first fix then swung 3 chapters into the SHORTEST-side tell
  // (lenTell 5-6 vs W2 shortestMax 4). The card now states BOTH gates as hard caps
  // with the anti-pendulum instruction.
  assert.ok(AUTHOR_QUALITY_BAR.includes("AT MOST ONE of the 9 questions"), "#18/B12 the longest-key band matches the tellRate gate");
  assert.ok(AUTHOR_QUALITY_BAR.includes("uniquely SHORTEST in AT MOST FOUR"), "#18/B14 the shortest-key cap matches W2 shortestMax as a GATE");
  assert.ok(AUTHOR_QUALITY_BAR.includes("Do not fix one tell by minting the other"), "#18/B14 anti-pendulum instruction present");
  assert.ok(AUTHOR_PREMIUM_BLOCK.includes("REVERSE a default"), "insight demand");
  assert.ok(AUTHOR_PREMIUM_BLOCK.includes("does NOT apply"), "limits demand");
  const card = buildAuthorCard({
    bookId: BOOK, chapterNumber: 1, briefMd: "# Chapter 1\nbrief body", voice: null,
    packet: mkPacket(1, ["A cadence claim"]),
  });
  assert.ok(card.includes("WHAT PREMIUM MEANS"), "premium block in card");
  assert.ok(card.includes("sharedSpine"), "spine instruction in card");
  assert.ok(card.includes("teach it in full"), "#19 own-core-move counter-instruction");
  assert.ok(card.length < 26000, `card stays near budget (${card.length})`);
});

test("P6: projection marks bookWideDuplicate facts sharedSpine — but NEVER the chapter's own coreMoveFactId (#19)", () => {
  const packet = {
    ...mkPacket(1, ["a", "b", "c"]),
    coreMoveFactId: "ch1.fact.0",
  } as SourcePacketV1 & { coreMoveFactId: string };
  (packet.facts[0] as { bookWideDuplicate?: boolean }).bookWideDuplicate = true; // the core move IS book-wide
  (packet.facts[1] as { bookWideDuplicate?: boolean }).bookWideDuplicate = true;
  const proj = writerPacketProjection(packet);
  assert.equal(proj.facts[0].sharedSpine, undefined, "core move never spine-marked");
  assert.equal(proj.facts[1].sharedSpine, true, "other duplicate marked");
  assert.equal(proj.facts[2].sharedSpine, undefined, "non-duplicate unmarked");
});

// ── D1–D4: CHB10–13 ───────────────────────────────────────────────────────────

function saturate(ch: ChapterV21, word: string, times: number): ChapterV21 {
  const pad = Array.from({ length: times }, () => `The ${word} beats the ${word} plan.`).join(" ");
  return { ...ch, breakdown: { ...ch.breakdown, fullRead: ch.breakdown.fullRead + " " + pad } };
}

test("D1 CHB10: injecting CHB10_BAND_BLOCKER+1 saturated words flips the book to BLOCKER naming them", () => {
  // NOTE: the makeChapter fixture is deliberately repetitive (shared sentence
  // templates), so the fixture book itself may sit in CHB10's advisory band —
  // that is the check working, not a false positive (the real-corpus calibration
  // is the top-5 scan in the plan). This test asserts the DELTA: adding
  // blocker-count synthetic words produces a BLOCKER that names them.
  const varied = Array.from({ length: 9 }, (_, i) => makeChapter(BOOK, i + 1));
  const newIds = (fs: BudgetFinding[]) => fs.filter((f) => f.checkId.startsWith("CHB10"));
  const baseline = newIds(checkReaderBudgets(varied));
  assert.ok(baseline.every((f) => !f.message.includes("cadence")), "baseline never mentions the synthetic words");
  const words = ["cadence", "ledger", "signal", "vector", "tempo", "quorum", "beacon"].slice(0, CHB10_BAND_BLOCKER + 1);
  // 30 sentences × 2 mentions = 60/ch — far above any fixture filler word, so the
  // synthetic words top the finding's description list.
  const saturated = varied.map((ch) => words.reduce((acc, w) => saturate(acc, w, 30), ch));
  const found = newIds(checkReaderBudgets(saturated));
  assert.equal(found.length, 1, "fires once");
  assert.equal(found[0].severity, "blocker");
  assert.ok(found[0].message.includes("saturate the book"));
  assert.ok(found[0].message.includes("cadence"), "names the saturated words");
});

test("D3 CHB12: strawman rate blocks above 7% and honors the key-shares-family exception", () => {
  const chapters = Array.from({ length: 4 }, (_, i) => makeChapter(BOOK, i + 1));
  const strawed = chapters.map((ch) => ({
    ...ch,
    quiz: {
      ...ch.quiz,
      questions: ch.quiz.questions.map((q) => ({
        ...q,
        choices: q.choices.map((c, ci) => (ci === q.correctIndex ? c : `Polish the deck and announce it louder ${c}`)),
      })),
    },
  }));
  const found = checkReaderBudgets(strawed).filter((f) => f.checkId === "CHB12.strawman_rate");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "blocker");
  // Exception: when the KEY carries the family too, those distractors don't count.
  const keyShares = strawed.map((ch) => ({
    ...ch,
    quiz: {
      ...ch.quiz,
      questions: ch.quiz.questions.map((q) => ({
        ...q,
        choices: q.choices.map((c, ci) => (ci === q.correctIndex ? `Never just polish the deck: ${c}` : c)),
      })),
    },
  }));
  assert.equal(checkReaderBudgets(keyShares).filter((f) => f.checkId === "CHB12.strawman_rate").length, 0, "key-shares exception");
});

test("D4 CHB13: a practice verb leading > ceil(N/3) chapters fires ADVISORY (subordinate clauses skipped)", () => {
  const chapters = Array.from({ length: 9 }, (_, i) => ({
    ...makeChapter(BOOK, i + 1),
    tryThisNow: i < 5 ? "When the meeting ends, touch the first line of the note for 60 seconds." : `Write one ${i} line in the log.`,
  }));
  const found = checkReaderBudgets(chapters).filter((f) => f.checkId === "CHB13.practice_verb_family");
  assert.ok(found.some((f) => f.message.includes('"touch"')), `touch family flagged: ${JSON.stringify(found.map((f) => f.message))}`);
  assert.ok(found.every((f) => f.severity === "advisory"), "CHB13 stays advisory");
});

test("C2 helpers: churn evidence report is non-empty prose; saturation contributors rank the worst chapter first", () => {
  const varied = Array.from({ length: 9 }, (_, i) => makeChapter(BOOK, i + 1));
  const words = ["cadence", "ledger", "signal", "vector", "tempo", "quorum", "beacon"];
  const saturated = varied.map((ch) => words.reduce((acc, w) => saturate(acc, w, 8), ch));
  const worst = words.reduce((acc, w) => saturate(acc, w, 30), saturated[4]); // ch5 much worse
  saturated[4] = worst;
  const report = buildChurnEvidenceReport(saturated);
  assert.ok(report.length >= 1 && report.every((l) => typeof l === "string" && l.length > 0));
  assert.equal(rankSaturationContributors(saturated)[0], 5, "worst saturator ranks first");
});

// ── C1: lineage-keyed regen ledger + v1 migration ─────────────────────────────

function seedDesign(root: string, n: number, dealtSeed: string): void {
  const brief = {
    schemaVersion: "chapterflow-chapter-brief-v1",
    chapterNumber: n,
    openerType: "scene",
    challengeFrame: dealtSeed, // vary to vary the lineage
    practiceShape: "two-step-sequence",
  };
  const packet = { ...mkPacket(n, ["claim one"]), sourceHash: "srch-1" };
  writeJsonFile(chapterBriefPath(BOOK, n, { stateRoot: root }), brief);
  writeJsonFile(sourcePacketPath(BOOK, n, { stateRoot: root }), packet);
}

test("C1: lineage computes from packet identity + dealt fields; changing either re-keys; unreadable → null", () => {
  const root = mkdtempSync(join(tmpdir(), "c1-lin-"));
  try {
    seedDesign(root, 1, "audit-one-artifact");
    const a = computeRegenLineage(BOOK, 1, root);
    assert.ok(a && a.length === 12, "12-hex lineage");
    assert.equal(computeRegenLineage(BOOK, 1, root), a, "stable");
    seedDesign(root, 1, "teach-it-to-someone"); // re-deal → new lineage
    const b = computeRegenLineage(BOOK, 1, root);
    assert.ok(b && b !== a, "dealt change re-keys");
    assert.equal(computeRegenLineage(BOOK, 2, root), null, "missing artifacts → null (infra, never no-cap)");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("C1 #7/#9: v1 ledger migrates onto the ON-DISK design lineage once; raw legacy preserved; re-deal then frees the budget", () => {
  const root = mkdtempSync(join(tmpdir(), "c1-mig-"));
  try {
    seedDesign(root, 1, "audit-one-artifact");
    const p = authorRegenLedgerPath(BOOK, root);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ schemaVersion: "author-regen-ledger-v1", bookId: BOOK, updatedAt: "2026-07-03T00:00:00Z", consumed: { "1": 1 } }));
    // Unmigrated legacy counts conservatively toward ANY lineage (fail toward capping).
    const preMigration = loadAuthorRegenLedger(BOOK, root);
    assert.equal(regenConsumedFor(preMigration, 1, "whatever-lineage"), 1, "unmigrated legacy fails toward capping");
    // Migration stamps the count onto the CURRENT on-disk design.
    migrateLegacyRegenCounts(BOOK, root);
    const oldLineage = computeRegenLineage(BOOK, 1, root)!;
    const migrated = loadAuthorRegenLedger(BOOK, root);
    assert.equal(regenConsumedFor(migrated, 1, oldLineage), 1, "count lives on the old design lineage");
    assert.deepEqual(migrated.legacyConsumed, { "1": 1 }, "raw v1 audit preserved (#9)");
    assert.ok(migrated.legacyMigratedAt, "idempotence marker set");
    migrateLegacyRegenCounts(BOOK, root); // idempotent
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, oldLineage), 1, "no double count");
    // The rerun's re-deal (new dealt fields) → new lineage → fresh budget; old lineage still capped.
    seedDesign(root, 1, "teach-it-to-someone");
    const newLineage = computeRegenLineage(BOOK, 1, root)!;
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, newLineage), 0, "fresh budget on the redesigned chapter");
    recordRegenConsumed(BOOK, 1, newLineage, root);
    assert.equal(regenConsumedFor(loadAuthorRegenLedger(BOOK, root), 1, newLineage), 1, "same-design counts accumulate");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("C1 #8/#11: legacy count with uncomputable lineage THROWS (infra); an unparseable ledger file THROWS", () => {
  const root = mkdtempSync(join(tmpdir(), "c1-err-"));
  try {
    const p = authorRegenLedgerPath(BOOK, root);
    mkdirSync(dirname(p), { recursive: true });
    // Legacy count for ch2 whose brief/packet do NOT exist.
    writeFileSync(p, JSON.stringify({ schemaVersion: "author-regen-ledger-v1", bookId: BOOK, updatedAt: "t", consumed: { "2": 1 } }));
    assert.throws(() => migrateLegacyRegenCounts(BOOK, root), RegenLedgerError, "#8: uncomputable lineage is infra");
    writeFileSync(p, "{ torn json");
    assert.throws(() => loadAuthorRegenLedger(BOOK, root), RegenLedgerError, "#11: present-but-unparseable halts");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── C4: sampling ───────────────────────────────────────────────────────────────

test("C4 #6: empty salt is byte-identical to the unsalted seed; a salt rotates; force-include always re-reads the repaired bytes", () => {
  assert.deepEqual(selectSeededIdxs("execution", 9, 4), selectSeededIdxs("execution", 9, 4, ""), "default parity");
  const salted = selectSeededIdxs("execution", 9, 4, "-round2");
  assert.notDeepEqual(salted, selectSeededIdxs("execution", 9, 4), "salt rotates the sample");
  const chapters = Array.from({ length: 9 }, (_, i) => makeChapter(BOOK, i + 1));
  const sample = selectAcceptanceSample(BOOK, chapters, 4, "-round2", [7, 2]);
  const nums = sample.map((c) => c.number);
  assert.equal(nums.length, 4);
  assert.ok(nums.includes(7) && nums.includes(2), `regen targets force-included (#5): ${nums}`);
  assert.deepEqual([...nums].sort((a, b) => a - b), nums, "sorted by chapter number");
  assert.deepEqual(
    selectAcceptanceSample(BOOK, chapters, 4, "", []).map((c) => c.number),
    selectSeededIdxs(BOOK, 9, 4).map((i) => chapters[i].number),
    "no salt + no force = the classic sample",
  );
});

test("C2 #21: mapNamedBookComplaints returns ONLY chapter-named complaints — no fallback", () => {
  const readers = [
    { keyCheck: { disagreements: ["ch3 Q2: derived b, key says a"] }, oneParagraphVerdict: "chapter 5's examples cluster hard.", gateVerdict: "PASS", churn: "HIGH", valid: true },
    { keyCheck: { disagreements: [] }, oneParagraphVerdict: "templated throughout, no chapter stands out.", gateVerdict: "PASS", churn: "HIGH", valid: true },
  ] as never[];
  const named = mapNamedBookComplaints(readers, [3, 5, 7, 9]);
  assert.deepEqual([...named.keys()].sort((a, b) => a - b), [3, 5], "named chapters only, no fallback fill");
});

// ── C3: flip signature + the tiebreak integration (adversarial #1/#2 regression) ──

test("C3 #2: isFlipSignature — keys 9/9 + composite ≥ bar + ship=false only; a key disagreement is NOT a flip", () => {
  const base = { valid: true, pass: false, ship84: false, composite: 87, keyCheck: { matches: 9, of: 9 } } as ChapterReviewV1;
  assert.ok(isFlipSignature(base, 84));
  assert.ok(!isFlipSignature({ ...base, keyCheck: { matches: 8, of: 9 } } as ChapterReviewV1, 84), "key defect must regen");
  assert.ok(!isFlipSignature({ ...base, composite: 83.6 } as ChapterReviewV1, 84), "true low score must regen (ch08 case)");
  assert.ok(!isFlipSignature({ ...base, valid: false } as ChapterReviewV1, 84), "invalid read never tiebreaks");
  assert.ok(!isFlipSignature({ ...base, pass: true, ship84: true } as ChapterReviewV1, 84), "a pass needs nothing");
});

test("Phase 3: isNearBar generalizes the trigger — supersets the flip case AND rescues a hair below the bar", () => {
  // bar 80, band 3.7 → near-bar window is composite ≥ 76.3.
  const clean = { valid: true, pass: false, keyCheck: { matches: 9, of: 9 } };
  const flip = { ...clean, ship84: false, composite: 86 } as ChapterReviewV1; // the old flip case
  assert.ok(isNearBar(flip, 80, 3.7), "flip case (composite ≥ bar, ship=false) is still near-bar");
  const justUnder = { ...clean, ship84: true, composite: 79.2 } as ChapterReviewV1; // shipped reader, composite short
  assert.ok(isNearBar(justUnder, 80, 3.7), "79.2 at bar 80 is inside the band → earns extra reads (NEW)");
  const atBandEdge = { ...clean, ship84: false, composite: 76.3 } as ChapterReviewV1;
  assert.ok(isNearBar(atBandEdge, 80, 3.7), "exactly bar−band is inclusive");
  const belowBand = { ...clean, ship84: false, composite: 76.2 } as ChapterReviewV1;
  assert.ok(!isNearBar(belowBand, 80, 3.7), "outside the band is a clear FAIL → straight to regen, one read");
  // True blockers are NEVER near-bar noise.
  assert.ok(!isNearBar({ ...clean, ship84: false, composite: 82, keyCheck: { matches: 8, of: 9 } } as ChapterReviewV1, 80, 3.7), "a key defect is a true blocker, not noise");
  assert.ok(!isNearBar({ ...clean, valid: false, ship84: false, composite: 82 } as ChapterReviewV1, 80, 3.7), "an invalid read never tiebreaks");
  assert.ok(!isNearBar({ ...clean, pass: true, ship84: true, composite: 82 } as ChapterReviewV1, 80, 3.7), "a PASS is not a tiebreak candidate");
  // band 0 collapses to the flip case (composite ≥ bar only).
  assert.ok(isNearBar(flip, 80, 0), "band 0 still fires the flip arm (composite ≥ bar)");
  assert.ok(!isNearBar({ ...clean, ship84: true, composite: 79.9 } as ChapterReviewV1, 80, 0), "band 0 disables the below-bar rescue");
});

function readerReply(ch: ChapterV21, opts: { ship: boolean; score: number; complaint?: string; keyWrong?: boolean }): string {
  const answers = ch.quiz.questions.map((q) => "abc"[q.correctIndex]);
  // keyWrong: this reader DERIVES a different answer for Q1 than the key — a
  // key-soundness disagreement, i.e. a deterministic true blocker (not noise).
  if (opts.keyWrong && answers.length > 0) answers[0] = answers[0] === "a" ? "b" : "a";
  const body = {
    quizDerivation: {
      answers,
      keyDisagreements: opts.keyWrong ? ["Q1: the prose supports a different answer than the key"] : [],
      tells: [],
    },
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, opts.score])),
    ship84: opts.ship,
    quotes: [{ quote: ch.title, why: "verbatim" }],
    complaints: opts.complaint ? [{ unit: "quiz Q1", problem: opts.complaint, mustFix: true }] : [],
    oneParagraphVerdict: opts.ship ? "ships clean" : "near-bar must-fix",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

function bookAcceptReply(chapters: ChapterV21[]): string {
  const body = {
    gate_verdict: "PASS",
    book3_churn: "LOW",
    quizDerivation: Object.fromEntries(chapters.map((ch) => [String(ch.number), { answers: ch.quiz.questions.map((q) => "abc"[q.correctIndex]), keyDisagreements: [] }])),
    scores: Object.fromEntries(REVIEW_FACTORS.map((f) => [f, 90])),
    quotes: [{ quote: chapters[0].title, why: "authored" }],
    oneParagraphVerdict: "individually authored",
  };
  return "```json\n" + JSON.stringify(body) + "\n```";
}

test("C3 integration #1: a flip-FAIL converts on 2/3 SHIP with NO regen consumed, the DECIDING PASS owns the latest-pointer, and the FAIL's complaints survive in tiebreak notes", async () => {
  const chapters = [makeChapter(BOOK, 1)];
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  const spawns: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o.sessionId);
      let msg: string;
      if (o.sessionId.includes("tiebreak")) msg = readerReply(chapters[0], { ship: true, score: 89 });
      else if (o.sessionId.includes("author-review-ch")) msg = readerReply(chapters[0], { ship: false, score: 87, complaint: "distractors rejectable by tone alone" });
      else if (o.sessionId.includes("author-book-reader")) msg = bookAcceptReply(chapters);
      else msg = "done";
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => chapters.map((c) => c.number),
    log: () => {},
  } as unknown as AutopilotDeps;

  const persisted: ChapterReviewV1[] = [];
  let regensConsumed = 0;
  const tmpDoc = mkdtempSync(join(tmpdir(), "c3-int-"));
  const io: Partial<AuthorReviewIo> = {
    loadChapters: () => chapters,
    authorSessionOf: () => "the-author",
    chapterExists: () => true,
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(tmpDoc, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: (bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
    persistAcceptance: () => "/tmp/a.json",
    acceptance: {
      openRound: () => ({ roundId: "r-int", tokens: {} }),
      writeBar: () => "/tmp/bar.json",
      writeConfirm: () => "/tmp/confirm.json",
      writeAttestation: () => "/tmp/att.json",
    },
    evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => { regensConsumed++; },
    migrateRegenLedger: () => {},
  };
  try {
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 84, io });
    assert.equal(result, null, `phase completes: ${JSON.stringify(result)}`);
    assert.equal(spawns.filter((s) => s.includes("tiebreak")).length, 2, "exactly two tiebreak readers");
    assert.equal(regensConsumed, 0, "NO regen budget consumed by the conversion");
    assert.equal(spawns.filter((s) => s.includes("author-ch")).length, 0, "no writer spawned");
    // #1: the deciding PASS is the LAST persisted record for the chapter — the
    // latest-pointer and the clears rebuild both see the majority verdict.
    const forChapter = persisted.filter((r) => r.chapterNumber === 1);
    assert.ok(forChapter.length >= 2, "original FAIL + deciding PASS both persisted");
    const last = forChapter[forChapter.length - 1];
    assert.equal(last.pass, true, "deciding PASS persisted LAST");
    assert.equal(last.ship84, true);
    // Losing side preserved (#4): the FAIL's must-fix complaint rides the notes.
    const notes = loadTiebreakNotes(BOOK);
    const note = notes.find((t) => t.chapterNumber === 1 && t.outcome === "converted-to-pass");
    assert.ok(note, "tiebreak note written");
    assert.ok(note!.overriddenComplaints.some((c) => c.includes("tone")), "overridden complaint preserved");
  } finally {
    rmSync(tmpDoc, { recursive: true, force: true });
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
    rmSync(join(dirname(reviewDir(BOOK)), `${BOOK}.review-clears.json`), { force: true });
  }
});

test("C3 integration: a tiebreak SPLIT (1 ship / 1 no-ship) upholds the FAIL — no PASS persists, the regen writer card carries the MERGED complaints", async () => {
  const chapters = [makeChapter(BOOK, 1)];
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  const spawns: string[] = [];
  const writerTasks: string[] = [];
  let n = 0;
  let tiebreakCount = 0;
  const deps = {
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push(o.sessionId);
      let msg: string;
      if (o.sessionId.includes("tiebreak")) {
        tiebreakCount++;
        msg = tiebreakCount % 2 === 1
          ? readerReply(chapters[0], { ship: true, score: 88 })
          : readerReply(chapters[0], { ship: false, score: 86, complaint: "examples cluster in one scene class" });
      } else if (o.sessionId.includes("author-review-ch")) {
        msg = readerReply(chapters[0], { ship: false, score: 87, complaint: "distractors rejectable by tone alone" });
      } else if (o.sessionId.includes("author-book-reader")) {
        msg = bookAcceptReply(chapters);
      } else {
        // The regen WRITER session: capture its card; write no file, so the
        // regen reports failure and the run stays fail-closed (halt content).
        writerTasks.push(o.task);
        msg = "done";
      }
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => chapters.map((c) => c.number),
    log: () => {},
    runVerb: async () => ({ code: 0, stdout: "gate ok", stderr: "" }),
  } as unknown as AutopilotDeps;

  const persisted: ChapterReviewV1[] = [];
  const tmpDoc = mkdtempSync(join(tmpdir(), "c3-split-"));
  const io: Partial<AuthorReviewIo> = {
    loadChapters: () => chapters,
    authorSessionOf: () => "the-author",
    chapterExists: () => true,
    // The regen writer's card seams: a real brief/packet so buildAuthorCard runs
    // (the complaints land on the card, which the spawn mock captures). The
    // writer "session" writes nothing → the byte-identical guard fails the regen
    // → the run halts fail-closed, which is exactly the asserted outcome.
    readBriefMd: () => "# Chapter 1\nbrief body",
    readPacket: () => mkPacket(1, ["a cadence claim"]),
    readBrief: () => null,
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(tmpDoc, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: (bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
    persistAcceptance: () => "/tmp/a.json",
    acceptance: {
      openRound: () => ({ roundId: "r-int", tokens: {} }),
      writeBar: () => "/tmp/bar.json",
      writeConfirm: () => "/tmp/confirm.json",
      writeAttestation: () => "/tmp/att.json",
    },
    evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
    migrateRegenLedger: () => {},
  };
  try {
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 84, io });
    assert.equal(spawns.filter((s) => s.includes("tiebreak")).length, 2, "one tiebreak pair on the original read");
    assert.ok(persisted.every((r) => r.chapterNumber !== 1 || r.pass === false), "#1: NO PASS ever persisted on a split");
    assert.ok(writerTasks.length >= 1, "regen writer spawned with a card");
    assert.ok(writerTasks[0].includes("tone alone"), "original complaint on the regen card");
    assert.ok(writerTasks[0].includes("cluster in one scene class"), "#4: the corroborating tiebreak FAIL's complaint merged onto the card");
    assert.ok(result !== null && result.status === "halt" && result.category === "content", `fail-closed halt, got ${JSON.stringify(result)}`);
    const note = loadTiebreakNotes(BOOK).find((t) => t.chapterNumber === 1 && t.outcome === "fail-stands");
    assert.ok(note, "fail-stands note written");
  } finally {
    rmSync(tmpDoc, { recursive: true, force: true });
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
  }
});

test("Phase 3 integration: a BELOW-bar FAIL (79, ship=false) converts on a median ≥ 80 with ship-majority — no regen consumed", async () => {
  const chapters = [makeChapter(BOOK, 1)];
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  const spawns: string[] = [];
  let n = 0;
  const deps = {
    spawn: (async (o: { sessionId: string }) => {
      spawns.push(o.sessionId);
      let msg: string;
      // Original read: 79 (a hair under the 80 bar), ship=false → previously a
      // straight regen; now near-bar → earns two tiebreak reads at 81, ship=true.
      if (o.sessionId.includes("tiebreak")) msg = readerReply(chapters[0], { ship: true, score: 81 });
      else if (o.sessionId.includes("author-review-ch")) msg = readerReply(chapters[0], { ship: false, score: 79, complaint: "one summary reads thin" });
      else if (o.sessionId.includes("author-book-reader")) msg = bookAcceptReply(chapters);
      else msg = "done";
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => chapters.map((c) => c.number),
    log: () => {},
  } as unknown as AutopilotDeps;

  const persisted: ChapterReviewV1[] = [];
  let regensConsumed = 0;
  const tmpDoc = mkdtempSync(join(tmpdir(), "p3-below-"));
  const io: Partial<AuthorReviewIo> = {
    loadChapters: () => chapters,
    authorSessionOf: () => "the-author",
    chapterExists: () => true,
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(tmpDoc, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: (bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
    persistAcceptance: () => "/tmp/a.json",
    acceptance: {
      openRound: () => ({ roundId: "r-int", tokens: {} }),
      writeBar: () => "/tmp/bar.json",
      writeConfirm: () => "/tmp/confirm.json",
      writeAttestation: () => "/tmp/att.json",
    },
    evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => { regensConsumed++; },
    migrateRegenLedger: () => {},
  };
  try {
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 80, io });
    assert.equal(result, null, `phase completes: ${JSON.stringify(result)}`);
    assert.equal(spawns.filter((s) => s.includes("tiebreak")).length, 2, "exactly two tiebreak reads (cap 3 total)");
    assert.equal(regensConsumed, 0, "median conversion consumes NO regen budget");
    assert.equal(spawns.filter((s) => s.includes("author-ch")).length, 0, "no writer spawned");
    const last = persisted.filter((r) => r.chapterNumber === 1).at(-1)!;
    assert.equal(last.pass, true, "deciding PASS (median 81 ≥ 80) persisted last");
    assert.equal(last.composite, 81);
  } finally {
    rmSync(tmpDoc, { recursive: true, force: true });
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
    rmSync(join(dirname(reviewDir(BOOK)), `${BOOK}.review-clears.json`), { force: true });
  }
});

test("Phase 3 integration: a KEY DEFECT surfaced by a tiebreak read STICKS — the median never converts a true blocker", async () => {
  const chapters = [makeChapter(BOOK, 1)];
  rmSync(reviewDir(BOOK), { recursive: true, force: true });
  const spawns: string[] = [];
  const writerTasks: string[] = [];
  let n = 0;
  let tiebreakCount = 0;
  const deps = {
    spawn: (async (o: { sessionId: string; task: string }) => {
      spawns.push(o.sessionId);
      let msg: string;
      if (o.sessionId.includes("tiebreak")) {
        tiebreakCount++;
        // Both tiebreak reads would ship at a passing score, BUT one of them
        // derives a different key for Q1 — a deterministic key-soundness defect
        // that must block conversion no matter how high the median composite is.
        msg = tiebreakCount === 1
          ? readerReply(chapters[0], { ship: true, score: 88, keyWrong: true })
          : readerReply(chapters[0], { ship: true, score: 88 });
      } else if (o.sessionId.includes("author-review-ch")) {
        msg = readerReply(chapters[0], { ship: false, score: 86, complaint: "distractors rejectable by tone" });
      } else if (o.sessionId.includes("author-book-reader")) {
        msg = bookAcceptReply(chapters);
      } else {
        writerTasks.push(o.task);
        msg = "done"; // writer writes nothing → fail-closed halt (the asserted outcome)
      }
      return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => chapters.map((c) => c.number),
    log: () => {},
    runVerb: async () => ({ code: 0, stdout: "gate ok", stderr: "" }),
  } as unknown as AutopilotDeps;

  const persisted: ChapterReviewV1[] = [];
  const tmpDoc = mkdtempSync(join(tmpdir(), "p3-keydefect-"));
  const io: Partial<AuthorReviewIo> = {
    loadChapters: () => chapters,
    authorSessionOf: () => "the-author",
    chapterExists: () => true,
    readBriefMd: () => "# Chapter 1\nbrief body",
    readPacket: () => mkPacket(1, ["a cadence claim"]),
    readBrief: () => null,
    writeReviewDoc: (bookId, fileName, text) => {
      const abs = join(tmpDoc, `${bookId}-${fileName}`);
      writeFileSync(abs, text, "utf8");
      return { absPath: abs, relPath: abs };
    },
    persistReview: (bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
    persistAcceptance: () => "/tmp/a.json",
    acceptance: {
      openRound: () => ({ roundId: "r-int", tokens: {} }),
      writeBar: () => "/tmp/bar.json",
      writeConfirm: () => "/tmp/confirm.json",
      writeAttestation: () => "/tmp/att.json",
    },
    evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
    resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
    regenConsumedFor: () => 0,
    recordRegenConsumed: () => {},
    migrateRegenLedger: () => {},
  };
  try {
    const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 80, io });
    assert.equal(spawns.filter((s) => s.includes("tiebreak")).length, 2, "tiebreak ran");
    assert.ok(persisted.every((r) => r.chapterNumber !== 1 || r.pass === false), "NO PASS persisted — the key defect stuck");
    assert.ok(writerTasks.length >= 1, "escalated to the regen writer (true blocker → regen)");
    assert.ok(result !== null && result.status === "halt" && result.category === "content", `fail-closed halt, got ${JSON.stringify(result)}`);
  } finally {
    rmSync(tmpDoc, { recursive: true, force: true });
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
  }
});

test("QC calibration: complaintNamesReservedHarm TRUSTS reserved harm + ambiguous, DOWNGRADES subjective-only (never hides a blocker)", () => {
  const c = (unit: string, problem: string) => ({ unit, problem, mustFix: true });
  // Reserved-category harms → TRUE (blocks conversion).
  assert.equal(complaintNamesReservedHarm(c("quiz Q2", "the answer key is wrong — two choices are correct")), true);
  assert.equal(complaintNamesReservedHarm(c("deep read", "this fact is factually incorrect")), true);
  assert.equal(complaintNamesReservedHarm(c("example 3", "the scenario is fabricated — no such study exists")), true);
  assert.equal(complaintNamesReservedHarm(c("fast read", "contradicts the chapter's own claim in the hook")), true);
  assert.equal(complaintNamesReservedHarm(c("structure", "the summaries section is missing")), true);
  // Subjective-only, no reserved-harm signal → FALSE (downgraded, cannot block alone).
  assert.equal(complaintNamesReservedHarm(c("example 2", "reads as a slot-filler and could be richer")), false);
  assert.equal(complaintNamesReservedHarm(c("deep read", "the phrasing is a bit generic")), false);
  assert.equal(complaintNamesReservedHarm(c("quiz Q1", "the distractors are slightly weak")), false);
  assert.equal(complaintNamesReservedHarm(c("tone", "the rhythm is uneven and the pacing drags")), false);
  // Ambiguous (neither signal) → DEFAULT TRUST (never hide a possible blocker).
  assert.equal(complaintNamesReservedHarm(c("quiz Q3", "something is off here")), true);
  // Red-team: a REAL harm co-occurring with a subjective word STILL blocks —
  // reserved vocabulary is checked first and wins over the subjective marker.
  assert.equal(complaintNamesReservedHarm(c("tryThisNow", "the pacing makes the safety warning unreadable")), true);
  assert.equal(complaintNamesReservedHarm(c("example 1", "the generic phrasing states a factually wrong date")), true);
});

test("Phase 3 + QC calibration (2026-07-05): near-bar conversion is blocked ONLY by a mustFix that names a reserved-category harm — a subjective-only mustFix is downgraded and converts", async () => {
  // Shared harness: original + 2 tiebreak reads all ship=false at 82 (≥ bar 80),
  // keys clean, parameterized by the complaint text carried as a mustFix.
  const run = async (complaint: string | undefined) => {
    const chapters = [makeChapter(BOOK, 1)];
    rmSync(reviewDir(BOOK), { recursive: true, force: true });
    let n = 0; const persisted: ChapterReviewV1[] = []; let regens = 0;
    const spawns: string[] = [];
    const deps = {
      spawn: (async (o: { sessionId: string }) => {
        spawns.push(o.sessionId);
        let msg: string;
        if (o.sessionId.includes("tiebreak") || o.sessionId.includes("author-review-ch")) {
          msg = readerReply(chapters[0], { ship: false, score: 82, complaint });
        } else if (o.sessionId.includes("author-book-reader")) msg = bookAcceptReply(chapters);
        else { msg = "done"; }
        return { ok: true, exitCode: 0, finalMessage: msg, stdout: msg, stderr: "", durationMs: 1, sessionId: o.sessionId };
      }) as unknown as AutopilotDeps["spawn"],
      mkSessionId: (label: string) => `${label}#${++n}`,
      logSession: () => {}, expectedChapterNumbers: () => chapters.map((c) => c.number), log: () => {},
      runVerb: async () => ({ code: 0, stdout: "gate ok", stderr: "" }),
    } as unknown as AutopilotDeps;
    const tmpDoc = mkdtempSync(join(tmpdir(), "p3-mf-"));
    const io: Partial<AuthorReviewIo> = {
      loadChapters: () => chapters, authorSessionOf: () => "the-author", chapterExists: () => true,
      readBriefMd: () => "# Chapter 1\nbrief body", readPacket: () => mkPacket(1, ["a cadence claim"]), readBrief: () => null,
      writeReviewDoc: (bookId, fileName, text) => { const abs = join(tmpDoc, `${bookId}-${fileName}`); writeFileSync(abs, text, "utf8"); return { absPath: abs, relPath: abs }; },
      persistReview: (bookId, review) => { persisted.push(review); return "/tmp/r.json"; },
      persistAcceptance: () => "/tmp/a.json",
      acceptance: { openRound: () => ({ roundId: "r", tokens: {} }), writeBar: () => "/tmp/b.json", writeConfirm: () => "/tmp/c.json", writeAttestation: () => "/tmp/att.json" },
      evidence: { runKeyJudge: async () => ({ ok: true }), runSweep: async () => ({ ok: true }) },
      resolveBeatShipped: async () => ({ ok: true, composite: null, source: "none" }),
      regenConsumedFor: () => 0, recordRegenConsumed: () => { regens++; }, migrateRegenLedger: () => {},
    };
    try {
      const result = await doAuthorReview(BOOK, deps, { maxParallel: 2, bar: 80, io });
      return { result, persisted, regens, spawns };
    } finally { rmSync(tmpDoc, { recursive: true, force: true }); rmSync(reviewDir(BOOK), { recursive: true, force: true }); rmSync(join(dirname(reviewDir(BOOK)), `${BOOK}.review-clears.json`), { force: true }); }
  };

  // (1) No mustFix → no true blocker → converts on the ≥bar median despite ship=false.
  const clean = await run(undefined);
  assert.equal(clean.result, null, `no-mustFix book completes: ${JSON.stringify(clean.result)}`);
  assert.equal(clean.regens, 0, "no-mustFix conversion consumes no regen");
  assert.equal(clean.persisted.filter((r) => r.chapterNumber === 1).at(-1)!.pass, true, "≥bar + zero mustFix converts to PASS");

  // (2) A SUBJECTIVE-only mustFix (a thin example — "could be richer") is downgraded
  //     by complaintNamesReservedHarm → it CANNOT block a ≥bar clean chapter alone →
  //     converts, no regen. This is the calibration: production editor, not perfectionist.
  const subjective = await run("a thin example reads as a slot-filler and could be richer");
  assert.equal(subjective.result, null, `subjective-only mustFix still completes: ${JSON.stringify(subjective.result)}`);
  assert.equal(subjective.regens, 0, "a downgraded subjective mustFix consumes no regen");
  assert.equal(subjective.persisted.filter((r) => r.chapterNumber === 1).at(-1)!.pass, true, "subjective-only mustFix downgraded → converts");

  // (3) A RESERVED-category mustFix (a wrong quiz answer key) is a TRUE blocker →
  //     never converted → escalates (fail-closed halt here). Blockers stay strict.
  const blocked = await run("quiz Q2: the answer key is wrong — two choices are correct");
  assert.ok(blocked.persisted.every((r) => r.chapterNumber !== 1 || r.pass === false), "a reserved-harm mustFix is never converted by the no-mustFix path");
  assert.ok(blocked.result !== null && blocked.result.status === "halt", "the reserved-harm blocker escalates (no false pass)");
});

// ── Budget-repair round (live-added after the first S-tier run blocked here) ──

test("budget repair: per-chapter complaints name each chapter's OWN band words and strawman hits; advisories route nothing", () => {
  const varied = Array.from({ length: 9 }, (_, i) => makeChapter(BOOK, i + 1));
  const words = ["cadence", "ledger", "signal", "vector", "tempo", "quorum", "beacon"];
  const saturated = varied.map((ch) => words.reduce((acc, w) => saturate(acc, w, 30), ch));
  saturated[2] = {
    ...saturated[2],
    quiz: {
      ...saturated[2].quiz,
      questions: saturated[2].quiz.questions.map((q) => ({
        ...q,
        choices: q.choices.map((c, ci) => (ci === q.correctIndex ? c : `Polish the deck ${c}`)),
      })),
    },
  };
  const blockers = checkReaderBudgets(saturated).filter((f) => f.severity === "blocker");
  assert.ok(blockers.some((f) => f.checkId === "CHB10.lexical_saturation"), "saturation blocks");
  assert.ok(blockers.some((f) => f.checkId === "CHB12.strawman_rate"), "strawman blocks");
  const targets = buildBudgetRepairComplaints(saturated, blockers);
  assert.ok(targets.size >= 8, `saturation routes to (nearly) every chapter: ${targets.size}`);
  const ch3 = targets.get(3) ?? [];
  assert.ok(ch3.some((l: string) => l.includes("CHB10") && l.includes("'cadence'")), "ch3 sees its own band counts");
  assert.ok(ch3.some((l: string) => l.includes("CHB12") && l.includes("Polish the deck")), "ch3 sees its own strawman hits verbatim");
  assert.ok((targets.get(1) ?? []).every((l: string) => !l.includes("CHB12")), "chapters without hits get no strawman complaint");
  // Advisory-only findings route nothing.
  assert.equal(buildBudgetRepairComplaints(varied, []).size, 0, "no blockers → no targets");
});

test("P1b/P3b: scene-furniture budget rides the brief; rule 5 carries the mechanical distractor scan", () => {
  const lines = briefVarietyInstructionLines({
    openerType: "scene", challengeFrame: "audit-one-artifact", practiceShape: "two-step-sequence",
    exampleLenses: ["dialogue-beat", "postmortem", "before-after-ledger"],
    practiceVerb: "circle", requireFrictionExample: true, frameworkNouns: ["cadence"],
  } as ChapterBriefV1).join("\n");
  assert.ok(lines.includes("SCENE-FURNITURE BUDGET"), "furniture budget present");
  assert.ok(lines.includes("review, meeting, room, plan, work"), "static furniture list present");
  // STIER-2 rebase: the "scan ALL 18" protocol is subsumed by the TRANSFORM recipe;
  // the banned mechanical families + the deterministic 7% stake stay named (grill 2b #17).
  assert.ok(AUTHOR_QUALITY_BAR.includes("polish/announce/slides"), "rule 5 still names the banned mechanical families");
  assert.ok(AUTHOR_QUALITY_BAR.includes("blocks above 7%"), "rule 5 names the deterministic stake");
});
