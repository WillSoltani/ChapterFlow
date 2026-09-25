/**
 * Q06 PR 1: shorter surfaces and varied example, quiz and plan shapes.
 *
 * The Franklin candidate rr21 read churn HIGH in 4 of 4 rubric draws and runs about
 * twice as long as the books that meet the bar (median 30,083 reader characters per
 * chapter against 12.7-18.1k). The contract text forced several of the stamps the
 * readers named: the quiz contract listed its cue words as OPENERS ("you are…",
 * "imagine…", "suppose…"), the action contract asked for TWO hardSpecifics where
 * SEC74 requires one, the whyItMatters rule pushed the case token into the closing
 * clause, and the dealer handed every chapter's ex01/ex02 the same two templated
 * staging frames. This file pins the contract half: the new ceilings, the caps on
 * every de-uniformization instruction, and the removal of the forcing lines. The
 * dealer half is pinned in tests/dealing-redesign.test.ts.
 *
 * No gate changes here: SEC117's predicate, threshold, severity and TRANSFER_CUES are
 * untouched, and only its BLOCKER MESSAGE is reworded (the remedy it named was false).
 */

import assert from "node:assert/strict";

import { CHAPTER_EDITOR_BRIEF } from "../../src/app/chapterEditorContract.js";
import { buildRepairWritingContract } from "../../src/app/candidateRepairWritingContract.js";
import type { ChapterBlueprintV1, LearningPackV1, SectionKind, SourcePacketV1 } from "../../src/artifacts/artifactTypes.js";
import { TRANSFER_CUES, isTransferQuestion } from "../../src/metrics/rubricMetrics.js";
import { validateActionPack, validateLearningPack } from "../../src/sections/sectionGate.js";
import { buildSectionTaskMarkdown, sectionContract } from "../../src/sections/sectionTasks.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const EM_DASH = "\u2014";

const CUE_LIST = TRANSFER_CUES.map((cue) => `"${cue}"`).join(", ");

// The exact new lines. Each is checked for presence in the contract it belongs to,
// and for the em dash the DO NOT block bans.
const NEW_LINES: Record<SectionKind, string[]> = {
  "summary-pack": [
    "The hook is at most 25 words: one short sentence, or two when the dealt hookShape needs a turn (a question into a scene, a contrast of two moments).",
    "Close fullRead on a consequence, a turn in the story, or what the move makes possible. The hard edge or limit belongs in fullRead's body; a closing sentence built on a limit or a negation (not, never, no, only) is the exception, at most one chapter in three.",
  ],
  "example-pack": [
    "LENGTH: each scenario runs 50-90 words (and never under the 180-character floor); whyItMatters is at most 2 sentences, about 40 words.",
    "whyItMatters explains, in the scene's own terms, why the move works or where it stops working, using the cited fact's MECHANISM and what the moment shows (the choice, in a decision slot). Name the source case in at most one short clause and never retell its anecdote: the chapter's prose teaches the case, and repeating its names and numbers is not an explanation (SEC39 checks the mechanism).",
    "whatToDo is the ONE move the reader would make in that moment, not already narrated in the scenario. Vary its KIND across the six: a question to ask, something to stop, a timing change, a person to bring in, a limit to set, a record to keep. Use at least four different kinds, in no fixed order, and at most two of the six whatToDo may tell the reader to write, log, sign, date or check a record.",
    "source facts DRIVE what happens in the scene (the choice, in a decision slot)",
  ],
  "learning-pack": [
    `At least 7 of 9 questions pose a NEW scenario IN THE STEM. SEC117 counts a stem as a scenario only when one of these cue phrases appears somewhere in it, written exactly this way: ${CUE_LIST} ("you're" does not count as "you are"). The cue does not have to open the stem: open on the situation itself ("A supplier's invoice arrives a week early and you are the clerk who signs it off; ..."), and no single first word may open more than 3 of the 9 stems. An apply-level bloomsLevel counts for nothing the stem does not say (SEC117); the validator enforces this.`,
    "Keep each stem to 30 words or fewer and name at most one case.",
    "A card back answers its front in ONE idea, in 25 words or fewer.",
  ],
  "action-pack": [
    "LENGTH: tryThisNow at most 35 words; coreSkill at most 60; each ifThenPlans[].plan at most 30; twentyFourHourChallenge and weeklyPractice at most 40 each.",
    "Cite implementation_guidance anchors (SEC73). Prefer citing the chapter's fact; when a unit cites an anchor that lists hardSpecifics (a case does), include ONE of them verbatim, not more (SEC74), and translate the case's mechanism into the reader's own behavior instead of retelling the case; the validator enforces this.",
    "Each ifThenPlans[].context is a situational trigger phrase (\"When a supplier asks for credit\", \"Right after a meeting ends\", \"The first time a new hire asks for help\", \"Before buying a familiar security\"), not a bare venue, source label, or stage direction (SEC67); the validator enforces this. No two of the three contexts open with the same word.",
    "Open weeklyPractice on the trigger of the dealt action.weeklyPracticeForm (a Sunday reset opens on Sunday; a recurring conversation opens on that conversation), never on a bare cadence such as \"Once a week\" or \"Every week\".",
  ],
};

const EDITOR_LENGTH_LINE = "LENGTH. Aim the whole chapter at about 16,000 reader-visible characters. Cut restatement, never substance, and never below a floor the section rules set (the tier floors, a scenario's 180 characters). Ceilings: a scenario 50 to 90 words; whyItMatters two sentences, about 40 words; a quiz stem 30 words; a card back 25 words; tryThisNow 35; coreSkill 60; each if-then plan 30; the 24-hour challenge and the weekly practice 40 each; the hook 25.";

// Lines (or fragments) the task removes because they force a stamp or state a false rule.
const REMOVED: Record<SectionKind, string[]> = {
  "summary-pack": [],
  "example-pack": [
    "never in the first clause",
    "the decision shown",
    "adds a new instruction/test/refusal rule",
    "source facts DRIVE the decision",
  ],
  "learning-pack": [
    "\"you are…\"",
    "\"imagine…\"",
    "\"suppose…\"",
    "Keep prompts lean",
    "an apply-level bloomsLevel no longer counts",
  ],
  "action-pack": [
    "at least two of a cited anchor's hardSpecifics",
  ],
};

requiredTest("Q06: every section contract carries its new ceilings, caps and rules, verbatim and without an em dash", () => {
  for (const kind of Object.keys(NEW_LINES) as SectionKind[]) {
    const contract = sectionContract(kind);
    for (const line of NEW_LINES[kind]) {
      assert.ok(contract.includes(line), `${kind}: missing the Q06 line: ${line}`);
      assert.ok(!line.includes(EM_DASH), `${kind}: a new line must not spend the em dash: ${line}`);
    }
    for (const gone of REMOVED[kind]) {
      assert.ok(!contract.includes(gone), `${kind}: the removed rule is still in the contract: ${gone}`);
    }
  }
});

requiredTest("Q06: the summary contract puts the tryThisNow ceiling on its optional tryThisNow", () => {
  const summary = sectionContract("summary-pack");
  assert.match(summary, /optional tryThisNow \(at most 35 words\)/, summary.split("\n")[0]);
});

requiredTest("Q06: the learning contract opens questions on a situation, not on a cue word", () => {
  const learning = sectionContract("learning-pack");
  // R-015 precedent: "rather than" is soft-banned (budget 15) and rr21 spent it 24
  // times, so the craft line says "not on a cue word" instead of the proposed
  // "rather than on a cue word".
  assert.ok(
    learning.includes("WHAT EXCELLENT LOOKS LIKE: transfer-first questions the reader reasons through, each opening on a concrete situation (a person, a moment, a pressure), not on a cue word, set to apply/analyze/evaluate."),
    learning,
  );
  // The cue list is rendered FROM the gate's lexicon, never hand-copied.
  for (const cue of TRANSFER_CUES) assert.ok(learning.includes(`"${cue}"`), `cue ${cue} must be rendered from TRANSFER_CUES`);
});

requiredTest("Q06: the chapter editor brief carries one LENGTH line with the same ceilings", () => {
  assert.ok(CHAPTER_EDITOR_BRIEF.includes(EDITOR_LENGTH_LINE), CHAPTER_EDITOR_BRIEF.join("\n"));
  assert.ok(!EDITOR_LENGTH_LINE.includes(EM_DASH));
  assert.ok(CHAPTER_EDITOR_BRIEF.every((line) => !line.includes(EM_DASH)), "no em dash may appear in the editor brief");
});

requiredTest("Q06: the repair writer and the chapter editor both receive the ceilings through sectionContract", () => {
  for (const lane of ["repair", "editor"] as const) {
    const contract = buildRepairWritingContract({ voiceCard: null, lane });
    for (const kind of Object.keys(NEW_LINES) as SectionKind[]) {
      for (const line of NEW_LINES[kind]) assert.ok(contract.includes(line), `${lane} lane: missing ${kind} line: ${line}`);
      for (const gone of REMOVED[kind]) assert.ok(!contract.includes(gone), `${lane} lane: removed ${kind} rule still rendered: ${gone}`);
    }
  }
});

// ── the DIRECT_JSON placeholders the model imitates ──────────────────────────────

function minimalBlueprint(): ChapterBlueprintV1 {
  return {
    chapterId: "zz-q06-ch01",
    chapterNumber: 1,
    title: "Q06",
    coreMove: { name: "change the visible signal" },
    reservedVariety: { hookShape: "direct_claim", answerIndexPattern: [0, 1, 2] },
    constraints: { forbiddenLeakage: [] },
    sections: { hook: {}, summaries: {}, examples: [], quiz: [], cards: [], action: {} },
  } as unknown as ChapterBlueprintV1;
}

function schemaHint(kind: SectionKind): Record<string, unknown> {
  const card = buildSectionTaskMarkdown({
    bookId: "zz-q06",
    kind,
    blueprint: minimalBlueprint(),
    sourcePacket: { schemaVersion: "source-packet-v1", facts: [] } as unknown as SourcePacketV1,
    outputPath: "/tmp/q06.json",
    context: { voiceCard: null, bookScars: null },
    deliveryMode: "DIRECT_JSON",
  });
  const start = card.indexOf("OUTPUT SCHEMA HINT\n```json\n") + "OUTPUT SCHEMA HINT\n```json\n".length;
  return JSON.parse(card.slice(start, card.indexOf("\n```", start))) as Record<string, unknown>;
}

requiredTest("Q06: the DIRECT_JSON placeholders do not model the stamps the contract removes", () => {
  const learning = schemaHint("learning-pack") as { quiz: { questions: Array<{ prompt: string }> } };
  const stem = learning.quiz.questions[0].prompt;
  const opening = stem.trim().toLowerCase();
  assert.ok(!TRANSFER_CUES.some((cue) => opening.startsWith(cue)), `the placeholder stem must not open on a cue phrase: ${stem}`);
  assert.ok(isTransferQuestion(stem), `the placeholder stem must still carry a cue SEC117 counts: ${stem}`);

  const example = schemaHint("example-pack") as { examples: Array<{ scenario: string }> };
  assert.equal(example.examples[0].scenario, "A named person lives a specific chapter-grounded moment and its consequence.");

  const action = schemaHint("action-pack") as { implementationPlan: { ifThenPlans: Array<{ context: string }> } };
  const context = action.implementationPlan.ifThenPlans[0].context;
  assert.doesNotMatch(context, /^Before\b/, `the placeholder context must not open with "Before": ${context}`);
});

requiredTest("Q06: every SEC67 trigger example in the action contract passes the SEC67 gate", () => {
  const examples = ["When a supplier asks for credit", "Right after a meeting ends", "The first time a new hire asks for help", "Before buying a familiar security"];
  const contract = sectionContract("action-pack");
  const bp = { chapterId: "zz-q06-ch01", chapterNumber: 1, sections: { action: {} } } as unknown as ChapterBlueprintV1;
  const packet = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;
  for (const context of examples) {
    assert.ok(contract.includes(`"${context}"`), `the contract must show the example: ${context}`);
    const pack = {
      schemaVersion: "section-artifact-v1",
      artifactType: "action-pack",
      chapterId: "zz-q06-ch01",
      tryThisNow: "",
      implementationPlan: { ifThenPlans: [{ context, plan: "If this happens, then act." }] },
    } as unknown as Parameters<typeof validateActionPack>[0];
    const sec67 = validateActionPack(pack, bp, packet).filter((f) => f.checkId === "SEC67.ifthen_context_trigger");
    assert.deepEqual(sec67, [], `SEC67 must accept the contract's own example: ${context}`);
  }
});

// ── the SEC117 blocker message: the remedy it names must be true ─────────────────

requiredTest("Q06: the SEC117 blocker tells the writer to put a cue anywhere in a new situation, not to open on one", () => {
  const recall = "Which statement best restates the definition given for the mechanism in the reading?";
  const pack = {
    schemaVersion: "section-artifact-v1",
    artifactType: "learning-pack",
    chapterId: "zz-q06-ch01",
    quiz: {
      passingScorePercent: 70,
      questions: Array.from({ length: 9 }, (_, i) => ({
        questionId: `q${String(i + 1).padStart(2, "0")}`,
        sourceAnchorIds: [],
        keyEvidenceAnchorIds: [],
        prompt: recall,
        choices: ["Lower the visible balance now.", "This distractor is deliberately the longest option by a clear margin here.", "Wait for the statement first."],
        correctIndex: 0,
        explanation: "The keyed action changes the visible signal.",
        bloomsLevel: "apply",
        depthLevel: "standard",
      })),
    },
    cards: { cards: [] },
  } as unknown as LearningPackV1;
  const bp = {
    chapterNumber: 1,
    chapterId: "zz-q06-ch01",
    sections: { quiz: Array.from({ length: 9 }, (_, i) => ({ questionId: `q${String(i + 1).padStart(2, "0")}`, correctIndex: 0, depthLevel: "standard" })), cards: [] },
  } as unknown as ChapterBlueprintV1;
  const packet = { allowedAnchors: [], facts: [], namedCases: [] } as unknown as SourcePacketV1;
  const sec117 = validateLearningPack(pack, bp, packet).filter((f) => f.checkId === "SEC117.quiz_transfer_floor");
  assert.equal(sec117.length, 1);
  // Predicate, threshold and severity are unchanged.
  assert.equal(sec117[0].severity, "blocker");
  const message = sec117[0].message;
  assert.match(message, /^only 0\/9 quiz questions pose a NEW scenario \(transfer floor 6\); these read as bare recall: q01, q02/);
  assert.ok(message.includes(CUE_LIST), `the cue list must be rendered from TRANSFER_CUES: ${message}`);
  assert.match(message, /anywhere in the stem, not necessarily first/, message);
  assert.match(message, /open on the situation itself/, message);
  assert.match(message, /do not open more than 3 of the 9 stems with the same word/, message);
  assert.doesNotMatch(message, /"you are…"|"imagine…"|"suppose…"/, "the opener list is gone");
  assert.doesNotMatch(message, /bloomsLevel/, "an apply-level bloomsLevel no longer satisfies SEC117 (R-069), so the message must not offer it");
});

// ── the SEC120 stand-down block ──────────────────────────────────────────────────

requiredTest("Q06: the SEC120 stand-down note no longer licenses a stood-down case's specifics", () => {
  const filler = (chars: number) => "The reader sees the visible balance change before the lender reads it. ".repeat(Math.ceil(chars / 70)).slice(0, chars);
  const prose = {
    hook: { hook: filler(220), counterintuition: filler(220) },
    breakdown: { fastRead: filler(600), deepRead: filler(1600), fullRead: filler(3400) },
    keyTakeaway: filler(200),
  };
  const packet = {
    schemaVersion: "source-packet-v1",
    facts: [],
    allowedAnchors: [{
      id: "ch01.case.absent",
      kind: "named_example",
      label: "Absent case",
      supportsClaimTypes: ["quiz_prompt", "quiz_explanation", "quiz_key_evidence", "review_card"],
      hardSpecifics: ["an absent research note", "the ledger of the harvest quarter"],
    }],
  } as unknown as SourcePacketV1;
  const card = buildSectionTaskMarkdown({
    bookId: "zz-q06",
    kind: "learning-pack",
    blueprint: minimalBlueprint(),
    sourcePacket: packet,
    outputPath: "/tmp/q06.json",
    context: { voiceCard: null, bookScars: null },
    chapterProse: prose,
  });
  const start = card.indexOf("SEC120 STANDS DOWN");
  assert.ok(start > 0, "the fixture must render the stand-down note");
  const note = card.slice(start, card.indexOf("\n\n", start) < 0 ? undefined : card.indexOf("\n\n", start));
  assert.doesNotMatch(note, /compels one/, note);
  assert.doesNotMatch(note, /may still use its SPECIFICS verbatim/, note);
  assert.match(note, /`ch01\.case\.absent`\. SEC120's year rule has NO stand-down, so a four-digit year the prose never states still blocks, even inside a stood-down case's own specific\./, note);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
