/**
 * STIER-2 levers (plan docs/v24/STIER2-PLAN-2026-07-03.md) — the v3 deals that
 * break the move-inventory stamp (P10 example arcs, P11 lead thread, P12 quiz
 * transform deals, P13 per-slot practice shapes, P14 memorable shapes, P15
 * limits placement, P16 grounding forms), the B0 card single-render fix, the
 * D7/D9 write-time contract, the M-lane model pin, and the lineage
 * stamp-preference (a v3 binary must never silently re-key a v2 brief's caps).
 *
 * Deliberately ABSENT: CHB14/15/17 gate tests — calibration (2026-07-03)
 * measured those meters INVERTED on the corpus (top-5 owner books score worse
 * than the halted bytes), so they ship as telemetry only; a regression test
 * here asserts they NEVER fire as findings.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import { makeChapter } from "./helpers.js";
import {
  EXAMPLE_ENTRY_POINTS,
  EXAMPLE_OUTCOMES,
  FIELD_STYLES,
  GROUNDING_FORMS,
  IDIOM_FAMILIES,
  LIMITS_PLACEMENTS,
  MEMORABLE_SHAPES,
  PRACTICE_SHAPES,
  QUIZ_FAILURE_MODES,
  QUIZ_STEM_SHAPES,
  ROTATION_SCHEMA_VERSION,
  SHELL_REGISTERS,
  dealBriefRotations,
  dealDistinctSet,
  dealEntryFloor,
  dealExampleArcs,
  dealExampleCounts,
  dealFrictionFlags,
  dealLeadPreference,
  dealQuestionFactOrder,
} from "../src/compiler/briefRotation.js";
import { briefVarietyInstructionLines, resolveLeadThread } from "../src/compiler/chapterBrief.js";
import type { ChapterBriefV1, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { chapterBriefPath, sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import {
  AUTHOR_PREMIUM_BLOCK,
  AUTHOR_QUALITY_BAR,
  AUTHOR_WRITER_EFFORT,
  AUTHOR_WRITER_MODEL,
  AUTHOR_WRITE_TIMEOUT_MS,
  authorWriteContractFindings,
  buildAuthorCard,
} from "../src/orchestrator/authorRun.js";
import { codexExecArgv } from "../src/orchestrator/codexAgent.js";
import { computeRegenLineage } from "../src/orchestrator/authorRegenLedger.js";
import { checkReaderBudgets, measureQuizKeyEcho, measureStemOpenerMolds } from "../src/critics/readerBudgets.js";

const BOOK = "zz-fixture-stier2";

function mkPacket(n: number, opts: { claims?: string[]; numbers?: string[]; cases?: Array<{ id: string; label: string }> } = {}): SourcePacketV1 {
  const claims = opts.claims ?? [
    "The accountability cadence makes every promise visible",
    "A return point turns agreement into a checkable commitment",
  ];
  return {
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    facts: claims.map((claim, i) => ({ id: `ch${n}.fact.${i}`, claim, groundedEntities: [], groundedNumbers: [], groundedPlaces: [] })),
    namedCases: (opts.cases ?? []).map((c) => ({ ...c, summary: `${c.label} summary`, hardSpecifics: [] })),
    allowedAnchors: [],
    allowedEntities: [],
    allowedNumbers: opts.numbers ?? [],
    allowedPlaces: [],
  } as unknown as SourcePacketV1;
}

// ── P10: example arcs ──────────────────────────────────────────────────────────

test("P10: dealExampleCounts ∈ {4,5,6}, deterministic, and not one value stamped book-wide", () => {
  const counts = dealExampleCounts(BOOK, 9);
  assert.equal(counts.length, 9);
  for (const c of counts) assert.ok(c >= 4 && c <= 6, `count ${c} in range`);
  assert.ok(new Set(counts).size >= 2, "the dealt counts vary across the book (the fixed six was reader-named)");
  assert.deepEqual(counts, dealExampleCounts(BOOK, 9), "deterministic");
});

test("P10: dealExampleArcs — row counts, jittered entry floors, friction-only failures, distinct styles, 2-3 props", () => {
  const frictions = dealFrictionFlags(BOOK, 9);
  const counts = dealExampleCounts(BOOK, 9);
  const arcs = dealExampleArcs(BOOK, 9, frictions, counts);
  assert.equal(arcs.length, 9);
  arcs.forEach((rows, i) => {
    const count = counts[i];
    assert.equal(rows.length, count, `ch${i + 1} rows == dealt count`);
    for (const r of rows) {
      assert.ok((EXAMPLE_ENTRY_POINTS as readonly string[]).includes(r.entry));
      assert.ok((EXAMPLE_OUTCOMES as readonly string[]).includes(r.outcome));
      assert.ok((FIELD_STYLES as readonly string[]).includes(r.fieldStyle));
    }
    const floor = Math.min(dealEntryFloor(BOOK, i), count);
    assert.ok(new Set(rows.map((r) => r.entry)).size >= floor, `ch${i + 1} ≥${floor} distinct entries (dealer-guaranteed, writer never counts)`);
    const failures = rows.filter((r) => r.outcome === "failure" || r.outcome === "partial").length;
    if (frictions[i]) {
      assert.ok(failures >= 1, `friction ch${i + 1} carries a dealt failure|partial slot`);
    } else {
      assert.equal(failures, 0, `non-friction ch${i + 1} gets NO dealt failure slot (the ×9 ritual stays un-stamped — round-2 #14 upheld)`);
    }
    assert.ok(new Set(rows.map((r) => r.fieldStyle)).size >= Math.min(4, count), `ch${i + 1} field styles spread`);
    const props = rows.filter((r) => r.prop).length;
    assert.ok(props >= 2 && props <= 3 && props < count, `ch${i + 1} props dealt to 2-3 slots, never all (${props}/${count})`);
  });
  // The jittered floors themselves vary — the variety PROFILE is not one fingerprint.
  const floors = arcs.map((_, i) => dealEntryFloor(BOOK, i));
  assert.ok(new Set(floors).size >= 2, "entry floors jitter across chapters");
  assert.deepEqual(arcs, dealExampleArcs(BOOK, 9, frictions, counts), "deterministic");
});

// ── P12: quiz deals ────────────────────────────────────────────────────────────

test("P12: stem shapes + failure modes deal 4 distinct per chapter; question order is a permutation of 1..9", () => {
  const stems = dealDistinctSet(BOOK, "brief-quiz-stem", QUIZ_STEM_SHAPES, 9, 4, 3);
  const modes = dealDistinctSet(BOOK, "brief-quiz-failure-mode", QUIZ_FAILURE_MODES, 9, 4, 3);
  for (const set of [...stems, ...modes]) {
    assert.equal(set.length, 4);
    assert.equal(new Set(set).size, 4, "distinct within a chapter");
  }
  assert.notDeepEqual(stems[0], stems[1], "adjacent chapters draw different stem sets");
  const orders = dealQuestionFactOrder(BOOK, 9);
  for (const perm of orders) {
    assert.deepEqual([...perm].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9], "a true permutation");
  }
  assert.ok(orders.some((p) => p.join(",") !== "1,2,3,4,5,6,7,8,9"), "the fact-order march is actually broken");
  assert.deepEqual(orders, dealQuestionFactOrder(BOOK, 9), "deterministic");
});

// ── P11: lead thread ───────────────────────────────────────────────────────────

test("P11: resolveLeadThread — case-led when preferred and anchored, invented otherwise; ~half the book prefers case-led", () => {
  const cases = [{ id: "c1", label: "Honeywell 1999 integration" }];
  assert.deepEqual(resolveLeadThread(true, cases, ["Mara"]), { kind: "owned-case", name: "Honeywell 1999 integration" });
  assert.deepEqual(resolveLeadThread(false, cases, ["Mara"]), { kind: "invented", name: "Mara" });
  // A label with no anchor token degrades to invented — and the BR8 gate for that
  // degenerate all-invented state is ADVISORY (deal-detector invariant).
  assert.deepEqual(resolveLeadThread(true, [{ id: "c1", label: "the turnaround" }], ["Mara"]), { kind: "invented", name: "Mara" });
  assert.equal(resolveLeadThread(true, [], []), undefined);
  const prefs = dealLeadPreference(BOOK, 9);
  const trueCount = prefs.filter(Boolean).length;
  assert.ok(trueCount >= 4 && trueCount <= 5, `~half the chapters prefer case-led (${trueCount}/9)`);
});

// ── v3 rotation + VARIETY render ───────────────────────────────────────────────

test("v3: dealBriefRotations carries every STIER-2 field; practice slots are 4 distinct with slot0 == legacy practiceShape", () => {
  const rotations = dealBriefRotations(BOOK, 9);
  assert.equal(ROTATION_SCHEMA_VERSION, "brief-rotation-v4");
    // STIER-3 (v4): the idiom pair rides every rotation.
  for (const [n, r] of rotations) {
    assert.equal(r.practiceSlotShapes.length, 4, `ch${n} four practice slots`);
    assert.equal(new Set(r.practiceSlotShapes).size, 4, `ch${n} distinct slots (the read-aloud ×4 chant is structurally impossible)`);
    assert.equal(r.practiceSlotShapes[0], r.practiceShape, `ch${n} slot0 stays the legacy dealt shape`);
    assert.equal(r.exampleArcs.length, r.exampleCount);
    assert.equal(r.quizStemShapes.length, 4);
    assert.equal(r.quizFailureModes.length, 4);
    assert.equal(r.memorableShapes.length, 3);
    assert.ok((LIMITS_PLACEMENTS as readonly string[]).includes(r.limitsPlacement));
    assert.ok((GROUNDING_FORMS as readonly string[]).includes(r.groundingForm));
    assert.equal(new Set(r.idiomFamilies).size, 2, `ch${n} two DISTINCT idiom families`);
    for (const f of r.idiomFamilies) assert.ok((IDIOM_FAMILIES as readonly string[]).includes(f));
    assert.ok((SHELL_REGISTERS as readonly string[]).includes(r.shellRegister));
  }
});

function mkV3Brief(n: number): ChapterBriefV1 {
  const r = dealBriefRotations(BOOK, 9).get(n)!;
  const cast = ["Mara", "Tobin", "Ines"];
  return {
    schemaVersion: "chapterflow-brief-v1",
    chapterId: `${BOOK}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: "The Return Point",
    coreMove: "tie every promise to a named return point",
    thesis: "Agreement without a return point decays into wish",
    readerPromise: "After this chapter, a reader can tie every promise to a named return point",
    ownedCases: [{ id: "c1", label: "Honeywell 1999 integration" }],
    notYours: ["Dell direct model", "Walmart shelf recovery"],
    cast,
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 16000, tolerance: 0.2 },
    flavor: [],
    openerType: r.openerType,
    challengeFrame: r.challengeFrame,
    practiceShape: r.practiceShape,
    exampleLenses: r.exampleLenses,
    practiceVerb: r.practiceVerb,
    requireFrictionExample: r.requireFrictionExample,
    frameworkNouns: ["cadence", "promise", "return"],
    rotationSchemaVersion: ROTATION_SCHEMA_VERSION,
    exampleCount: r.exampleCount,
    exampleArcs: r.exampleArcs,
    practiceSlotShapes: r.practiceSlotShapes,
    quizStemShapes: r.quizStemShapes,
    quizFailureModes: r.quizFailureModes,
    questionFactOrder: r.questionFactOrder,
    memorableShapes: r.memorableShapes,
    limitsPlacement: r.limitsPlacement,
    groundingForm: r.groundingForm,
    leadThread: resolveLeadThread(r.leadPreferReal, [{ id: "c1", label: "Honeywell 1999 integration" }], cast),
    idiomFamilies: r.idiomFamilies,
    shellRegister: r.shellRegister,
  } as ChapterBriefV1;
}

test("v3 VARIETY render: every dealt lever line present; v2 briefs render untouched (back-compat)", () => {
  const brief = mkV3Brief(5);
  const lines = briefVarietyInstructionLines(brief).join("\n");
  assert.ok(lines.includes("EXAMPLE PLAN: write EXACTLY"), "arc table present");
  assert.ok(lines.includes("+anchor"), "dealt prop slots marked");
  assert.ok(lines.includes("LEAD THREAD"), "lead thread present");
  assert.ok(lines.includes("QUIZ STEMS"), "stem shapes present");
  assert.ok(lines.includes("DISTRACTOR MODES"), "failure modes present");
  assert.ok(lines.includes("QUESTION ORDER"), "fact-order permutation present");
  assert.ok(lines.includes("PRACTICE SLOT SHAPES"), "per-slot shapes present");
  assert.ok(lines.includes("MEMORABLE LINES"), "memorable shapes present");
  assert.ok(lines.includes("LIMITS PLACEMENT"), "limits placement present");
  assert.ok(lines.includes("FIRST-MENTION GROUNDING"), "grounding form present");
  assert.ok(lines.includes("FRAMEWORK IDIOM"), "STIER-3 idiom line present");
  assert.ok(lines.includes("EXAMPLE SHELL REGISTER"), "STIER-3 shell line present");
  // The arc table is the single source of the failure slot — no duplicate friction
  // prose even when the flag is set (forced TRUE so the assertion can't pass vacuously).
  const frictionLines = briefVarietyInstructionLines({ ...brief, requireFrictionExample: true } as ChapterBriefV1).join("\n");
  assert.ok(!frictionLines.includes("At least ONE of your examples must show the move failing"), "v2 friction sentence suppressed when arcs carry the slot");
  // v2 brief (no v3 fields): the original lines render, none of the v3 lines do.
  // Force the friction flag TRUE — whether ch5 is friction-dealt is the dealer's
  // business; this assertion is about the v2 RENDER path, not the deal.
  const v2 = { ...brief } as Record<string, unknown>;
  for (const k of ["rotationSchemaVersion", "exampleCount", "exampleArcs", "practiceSlotShapes", "quizStemShapes", "quizFailureModes", "questionFactOrder", "memorableShapes", "limitsPlacement", "groundingForm", "leadThread", "idiomFamilies", "shellRegister"]) delete v2[k];
  v2.requireFrictionExample = true;
  const v2lines = briefVarietyInstructionLines(v2 as ChapterBriefV1).join("\n");
  assert.ok(!v2lines.includes("EXAMPLE PLAN"), "no v3 lines on a v2 brief");
  assert.ok(!v2lines.includes("FRAMEWORK IDIOM") && !v2lines.includes("EXAMPLE SHELL REGISTER"), "no v4 lines on a v2 brief");
  assert.ok(v2lines.includes("At least ONE of your examples must show the move failing"), "v2 friction sentence still renders on v2 briefs");
});

// ── B0: card single-render + real-size pin ─────────────────────────────────────

test("B0: the card carries each dealt VARIETY line exactly ONCE (md section stripped when the machine brief renders the block)", () => {
  const brief = mkV3Brief(5);
  // A realistic md: the VARIETY section sits between PROMISE and YOUR CASES.
  const varietyBlock = ["## VARIETY (dealt — do NOT default to the house pattern)", ...briefVarietyInstructionLines(brief)].join("\n");
  const briefMd = `# Chapter 5 — The Return Point\n\n## THE MOVE\ntie every promise to a named return point\n\n## PROMISE\nAfter this chapter…\n\n${varietyBlock}\n\n## YOUR CASES\n- Honeywell 1999 integration\n\n## LENGTH\n~16000 chars`;
  const packet = mkPacket(5, { cases: [{ id: "c1", label: "Honeywell 1999 integration" }] });
  const card = buildAuthorCard({ bookId: BOOK, chapterNumber: 5, briefMd, packet, voice: null, brief });
  const marker = "EXAMPLE PLAN: write EXACTLY";
  assert.equal(card.split(marker).length - 1, 1, "arc table appears exactly once in the card");
  assert.ok(card.includes("## YOUR CASES"), "non-VARIETY md sections survive the strip");
  // Without the machine brief the md keeps its own VARIETY section (graceful degrade).
  const cardNoBrief = buildAuthorCard({ bookId: BOOK, chapterNumber: 5, briefMd, packet, voice: null });
  assert.equal(cardNoBrief.split(marker).length - 1, 1, "degraded card still carries the md's own copy once");
});

test("B0 real-size pin: a full v3 brief + realistic packet keeps the card ≤ 24,000 chars (25k ceiling with margin)", () => {
  const brief = mkV3Brief(5);
  const varietyBlock = ["## VARIETY (dealt — do NOT default to the house pattern)", ...briefVarietyInstructionLines(brief)].join("\n");
  const filler = (i: number) =>
    `The ${i} cadence review ties one named promise to a return date a person can check without a meeting, and the miss is written where the team reads it`;
  const packet = mkPacket(5, {
    claims: Array.from({ length: 9 }, (_, i) => filler(i)),
    cases: [
      { id: "c1", label: "Honeywell 1999 integration" },
      { id: "c2", label: "GE Session C review" },
      { id: "c3", label: "Dell direct-model ledger" },
    ],
  });
  const briefMd = `# Chapter 5 — The Return Point\n\n## THE MOVE\ntie every promise to a named return point\n\n## PROMISE\nAfter this chapter…\n\n${varietyBlock}\n\n## YOUR CASES\n- Honeywell 1999 integration\n- GE Session C review\n- Dell direct-model ledger\n\n## NOT YOURS\n${Array.from({ length: 20 }, (_, i) => `- other case ${i}`).join("\n")}\n\n## CAST\nMara, Tobin, Ines\n\n## LENGTH\n~16000 chars`;
  const card = buildAuthorCard({ bookId: BOOK, chapterNumber: 5, briefMd, packet, voice: null, brief });
  assert.ok(card.length <= 24000, `real-shaped v3 card is ${card.length} chars (pin ≤ 24000; runtime ceiling 25000)`);
  console.log(`  [measure] STIER-2 real-shaped card: ${card.length} chars (pin 24,000 / ceiling 25,000)`);
});

// ── card text pins ─────────────────────────────────────────────────────────────

test("card pins: TRANSFORM recipe + de-theatered rule 3 + VOICE block + pruned INSIGHT clause + dealt LIMITS placement", () => {
  assert.ok(AUTHOR_QUALITY_BAR.includes("5. DISTRACTOR TRANSFORM"), "rule 5 is the transform recipe");
  assert.ok(AUTHOR_QUALITY_BAR.includes("ECHO SYMMETRY"), "echo symmetry named");
  assert.ok(AUTHOR_QUALITY_BAR.includes("polish/announce/slides"), "banned families still named (grill 2b #17)");
  assert.ok(!AUTHOR_QUALITY_BAR.includes("exact object to touch"), "rule 3's theater-minting shape is gone");
  assert.ok(AUTHOR_QUALITY_BAR.includes("never default to a touch-this-object"), "rule 3 bans the ritual instead");
  assert.ok(AUTHOR_PREMIUM_BLOCK.includes("- VOICE:"), "VOICE block replaces the TONE bullet");
  assert.ok(AUTHOR_PREMIUM_BLOCK.includes("never let more than 2 consecutive paragraphs"), "voice move 1 (scoped to tiers — never the dealt hook)");
  assert.ok(!AUTHOR_PREMIUM_BLOCK.includes("At least one example ends in failure"), "INSIGHT failure clause pruned — the dealt arcs carry it");
  assert.ok(AUTHOR_PREMIUM_BLOCK.includes("dealt LIMITS PLACEMENT"), "limits paragraph rides the dealt placement");
});

// ── D7/D9: write-time contract ─────────────────────────────────────────────────

test("D7: lead-thread contract — missing lead in fastRead or <2 examples complains; v2 briefs skip", () => {
  const brief = mkV3Brief(5);
  brief.leadThread = { kind: "invented", name: "Mara" };
  const chapter = makeChapter(BOOK, 5);
  chapter.breakdown.fastRead = "Mara reviews the promise ledger before the meeting starts and marks the missing return dates.";
  chapter.examples = chapter.examples.map((ex, i) => (i < 2 ? { ...ex, scenario: `Mara faces case ${i}: ${ex.scenario}` } : ex));
  const packet = mkPacket(5, {});
  assert.deepEqual(authorWriteContractFindings(chapter, brief, packet).filter((c) => c.startsWith("lead thread")), [], "present lead is clean");
  const rotated = makeChapter(BOOK, 5);
  rotated.breakdown.fastRead = "Yvonne reviews the ledger; Reagan marks the dates; Eliana closes the loop.";
  const complaints = authorWriteContractFindings(rotated, brief, packet).filter((c) => c.startsWith("lead thread"));
  assert.ok(complaints.length >= 1, "rotated-away lead complains (the ch05 Yvonne→Reagan→Eliana defect)");
  assert.deepEqual(authorWriteContractFindings(rotated, { ...brief, leadThread: undefined } as ChapterBriefV1, packet).filter((c) => c.startsWith("lead thread")), [], "v2 briefs skip by construction");
  // Case-led: the label's anchor token is what must thread.
  const caseBrief = { ...brief, leadThread: { kind: "owned-case" as const, name: "Honeywell 1999 integration" } };
  const caseCh = makeChapter(BOOK, 5);
  caseCh.breakdown.fastRead = "The Honeywell integration review starts with the promise list, not the slideware.";
  caseCh.examples = caseCh.examples.map((ex, i) => (i < 2 ? { ...ex, scenario: `Inside Honeywell, case ${i}: ${ex.scenario}` } : ex));
  assert.deepEqual(authorWriteContractFindings(caseCh, caseBrief, packet).filter((c) => c.startsWith("lead thread")), [], "case-led thread anchored by the label token");
});

test("D9: timer contract — odd invented timers complain, packet numbers exempt, cross-surface discrepancy on a shared action complains", () => {
  const brief = mkV3Brief(5);
  brief.leadThread = undefined; // isolate D9
  const packet = mkPacket(5, { numbers: ["90"] });
  const ch = makeChapter(BOOK, 5);
  ch.tryThisNow = "Spend 19 minutes tracing one promise to its return date.";
  const odd = authorWriteContractFindings(ch, brief, packet).filter((c) => c.startsWith("practice timers"));
  assert.ok(odd.some((c) => c.includes('"19 minutes"')), 'the "19-minute challenge" complaint fires');
  ch.tryThisNow = "Spend 90 minutes tracing one promise to its return date.";
  assert.equal(authorWriteContractFindings(ch, brief, packet).filter((c) => c.includes('"90 minutes"')).length, 0, "packet-attested numbers exempt (grill 2b #15)");
  ch.tryThisNow = "Spend 25 minutes tracing one promise to its return date.";
  assert.equal(authorWriteContractFindings(ch, brief, packet).filter((c) => c.startsWith("practice timers")).length, 0, "25 is in the round set (Pomodoro-safe)");
  // Same action verbatim across two surfaces with different minutes → discrepancy.
  ch.tryThisNow = "Spend 10 minutes tracing one promise to its exact return date today.";
  ch.implementationPlan.twentyFourHourChallenge = "Spend 15 minutes tracing one promise to its exact return date today.";
  const disc = authorWriteContractFindings(ch, brief, packet).filter((c) => c.includes("DIFFERENT minutes"));
  assert.ok(disc.length >= 1, "the 12-vs-10 class of discrepancy fires");
  ch.implementationPlan.twentyFourHourChallenge = "Before your next standup, ask who owns the oldest open promise and write the answer down. Spend 15 minutes on the audit of the board.";
  assert.equal(authorWriteContractFindings(ch, brief, packet).filter((c) => c.includes("DIFFERENT minutes")).length, 0, "different actions may carry different timers");
});

// ── M-lane: model pin ──────────────────────────────────────────────────────────

test("M-lane: author writers pin gpt-5.5 @ xhigh with a 60-min timeout; argv carries -c model= before effort", () => {
  assert.equal(AUTHOR_WRITER_MODEL, "gpt-5.5");
  assert.equal(AUTHOR_WRITER_EFFORT, "xhigh");
  assert.equal(AUTHOR_WRITE_TIMEOUT_MS, 3_600_000);
  const argv = codexExecArgv("do the thing", "workspace-write", [], false, "xhigh", "gpt-5.5");
  const modelIdx = argv.indexOf("model=gpt-5.5");
  const effortIdx = argv.indexOf("model_reasoning_effort=xhigh");
  assert.ok(modelIdx > 0 && argv[modelIdx - 1] === "-c", "-c model= present");
  assert.ok(effortIdx > 0 && argv[effortIdx - 1] === "-c", "-c effort present");
  assert.ok(modelIdx < effortIdx, "model precedes effort (stable ordering)");
  assert.equal(argv[argv.length - 1], "do the thing", "prompt stays the last positional arg");
  // Legacy call shape (no model) is byte-identical to the pre-STIER-2 argv.
  assert.deepEqual(
    codexExecArgv("t", "read-only", [], false, "high"),
    ["exec", "--sandbox", "read-only", "-c", "model_reasoning_effort=high", "t"],
  );
});

// ── C-lane: lineage stamp preference ───────────────────────────────────────────

test("lineage: an UNSTAMPED (v2) brief under the v3 binary reproduces the v2-era hash byte-for-byte; a stamped v3 brief re-keys", () => {
  const root = mkdtempSync(join(tmpdir(), "stier2-lineage-"));
  try {
    const packet = mkPacket(3, {});
    writeJsonFile(sourcePacketPath(BOOK, 3, { stateRoot: root }), packet);
    const v2Brief = {
      schemaVersion: "chapterflow-chapter-brief-v1",
      chapterId: `${BOOK}-ch03`,
      chapterNumber: 3,
      openerType: "scene",
      challengeFrame: "audit-one-artifact",
      practiceShape: "two-step-sequence",
      exampleLenses: ["dialogue-beat", "postmortem", "walkthrough"],
      practiceVerb: "circle",
      requireFrictionExample: true,
    };
    writeJsonFile(chapterBriefPath(BOOK, 3, { stateRoot: root }), v2Brief);
    const lineage = computeRegenLineage(BOOK, 3, root);
    assert.ok(lineage, "lineage computed");
    // Byte-contract: the v2-era construction — schema "brief-rotation-v2", the SIX v2
    // dealt keys, fact-id packet identity. If this ever drifts, existing consumed caps
    // silently reset (grill round-2b #9).
    const packetIdentity = (packet.facts ?? []).map((f) => `${f.id}:${f.claim ?? ""}`).join("|");
    const expected = createHash("sha256")
      .update(JSON.stringify({
        schema: "brief-rotation-v2",
        packetIdentity,
        dealt: {
          openerType: "scene",
          challengeFrame: "audit-one-artifact",
          practiceShape: "two-step-sequence",
          exampleLenses: ["dialogue-beat", "postmortem", "walkthrough"],
          practiceVerb: "circle",
          requireFrictionExample: true,
        },
      }))
      .digest("hex")
      .slice(0, 12);
    assert.equal(lineage, expected, "v2 brief + v3 binary == the v2-era lineage (caps never silently reset)");
    // Stamping the brief (a v3 re-deal) legitimately re-keys.
    writeJsonFile(chapterBriefPath(BOOK, 3, { stateRoot: root }), { ...v2Brief, rotationSchemaVersion: ROTATION_SCHEMA_VERSION });
    assert.notEqual(computeRegenLineage(BOOK, 3, root), lineage, "a stamped v3 deal re-keys the lineage (fresh budgets, honest)");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── B15: the dealt example count binds BOTH sides (live-caught, rerun round 2) ──

test("B15: A16's example floor honors the brief's dealt count; write contract enforces it exactly", async () => {
  const { dealtExampleFloor } = await import("../src/critics/finalGate.js");
  const root = mkdtempSync(join(tmpdir(), "stier2-b15-"));
  try {
    const chapter = makeChapter(BOOK, 3);
    // No brief on disk → the historical floor 6 (fail-closed for partial generation).
    assert.equal(dealtExampleFloor(chapter, root), 6, "absent brief → floor 6");
    // A v3-stamped brief dealing 4 → the floor is the dealt design, not the pad target.
    writeJsonFile(chapterBriefPath(BOOK, 3, { stateRoot: root }), { rotationSchemaVersion: ROTATION_SCHEMA_VERSION, exampleCount: 4 });
    assert.equal(dealtExampleFloor(chapter, root), 4, "dealt count wins for v3 briefs");
    // An UNSTAMPED brief never lowers the floor (v2 briefs have no count deal).
    writeJsonFile(chapterBriefPath(BOOK, 3, { stateRoot: root }), { exampleCount: 4 });
    assert.equal(dealtExampleFloor(chapter, root), 6, "unstamped brief → floor 6");

    // Write contract: EXACT count — padding past the deal is the density defect.
    const brief = mkV3Brief(5);
    brief.leadThread = undefined;
    const packet = mkPacket(5, {});
    const ch = makeChapter(BOOK, 5);
    const dealt = brief.exampleCount!;
    while ((ch.examples?.length ?? 0) > dealt) ch.examples!.pop();
    assert.equal(authorWriteContractFindings(ch, brief, packet).filter((c) => c.startsWith("example count")).length, 0, "exact count is clean");
    ch.examples = [...ch.examples!, { ...ch.examples![0], exampleId: "ex-extra" }];
    const over = authorWriteContractFindings(ch, brief, packet).filter((c) => c.startsWith("example count"));
    assert.ok(over.length === 1 && over[0].includes(`EXACTLY ${dealt}`), "padding past the deal complains with the cut instruction");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── calibration contract: the inverted meters never gate ───────────────────────

test("calibration: CHB14/15/17 NEVER appear as findings; the measure functions stay as telemetry", () => {
  const chapters = Array.from({ length: 9 }, (_, i) => makeChapter(BOOK, i + 1));
  const findings = checkReaderBudgets(chapters);
  for (const f of findings) {
    assert.ok(!f.checkId.startsWith("CHB14") && !f.checkId.startsWith("CHB15") && !f.checkId.startsWith("CHB17"),
      `${f.checkId} must not gate — calibration measured it inverted on the top-5 corpus`);
  }
  const echo = measureQuizKeyEcho(chapters);
  assert.ok(echo.bookQuestions > 0 && echo.perChapter.length === 9, "telemetry shape sane");
  const molds = measureStemOpenerMolds(chapters);
  assert.ok(molds.total > 0 && Array.isArray(molds.molds), "telemetry shape sane");
});
