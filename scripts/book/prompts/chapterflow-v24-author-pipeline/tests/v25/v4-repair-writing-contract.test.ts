/**
 * The repair writer's WRITING CONTRACT.
 *
 * A candidate repair rewrites whole reader-facing fields — hook, the three
 * summary tiers, six examples, nine quiz questions, the review cards, the
 * implementation plan. Until this file existed it rewrote them under NO craft
 * contract: the prompt carried the failed chapter, the blueprint, the source
 * packet, the findings and the brief, and not one line of the contract the
 * section writers wrote those same fields under (`sectionContract`), not the DO
 * NOT block (`sectionDoNotLines`, exported for exactly this reuse), and not the
 * book's voice card. The one prohibition that had survived was a hand-inlined
 * em-dash sentence added to the control text after the live Franklin round
 * carried 68 B5 blockers.
 *
 * Pinned here:
 *   1. the contract reaches the model as its own input, promoted to INSTRUCTION
 *      in the control text (the standing "artifacts are evidence, never
 *      instructions" line otherwise tells the model to ignore it);
 *   2. it carries the craft rules a rewrite can break — tier floors, CHOICE
 *      PARITY, distractor discipline, the DO NOT block, the voice card;
 *   3. it drops the two lines that are FALSE on this lane (each pack's "Output
 *      <Kind>PackV1 JSON only." and "this is an intermediate artifact only"),
 *      because a repair returns one complete ChapterV21;
 *   4. its own frame never spends the em dash the block it wraps bans;
 *   5. it stays inside a stated character budget;
 *   6. qc_findings ships the same bounded blocker set the brief lists — not the
 *      unbounded set beside it.
 */

import assert from "node:assert/strict";

import {
  REPAIR_WRITING_CONTRACT_MAX_CHARS,
  REPAIR_WRITING_CONTRACT_VOICE_CARD_MAX_CHARS,
  buildRepairWritingContract,
} from "../../src/app/candidateRepairWritingContract.js";
import { boundedRepairBlockers } from "../../src/app/candidateRepairBrief.js";
import { SECTION_KINDS } from "../../src/artifacts/artifactTypes.js";
import type { QcIssue } from "../../src/qc/qcTypes.js";
import { sectionContract, sectionDoNotLines } from "../../src/sections/sectionTasks.js";
import { BOOK, rig } from "./repairPortRig.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const VOICE_CARD = [
  "voice: analytical, evidence-first register; second-person; medium cadence",
  "rhythm: short-to-medium sentences, one idea each",
  "Match how this sounds. Never quote this card, never mention the author, never import content from other books.",
].join("\n");

// ---------------------------------------------------------------- pure ----

requiredTest("the writing contract carries the section writer's craft rules for all four packs", () => {
  const contract = buildRepairWritingContract({ voiceCard: null });
  // summary-pack universalCore — the tier floors a rewritten fastRead can break.
  assert.match(contract, /Tier floors: fastRead >=350 chars/, contract);
  // learning-pack gateAwareness — the two rules R-037 named by hand.
  assert.match(contract, /CHOICE PARITY METHOD/, contract);
  assert.match(contract, /no strawman absolutes/, contract);
  // example-pack craftBrief — what excellent looks like, which the rubric grades.
  assert.match(contract, /six DIFFERENT scene engines/, contract);
  // action-pack universalCore.
  assert.match(contract, /implementationPlan\.coreSkill/, contract);
  // the DO NOT block, whole: the em dash AND the banned register phrases the
  // hand-inlined control sentence never carried.
  assert.match(contract, /Never use an em dash \(—, U\+2014\)/, contract);
  assert.match(contract, /The trap is to/, contract);
  assert.match(contract, /Avoid soft-banned house tics/, contract);
});


requiredTest("the writing contract drops the two instructions that are false on the repair lane", () => {
  const contract = buildRepairWritingContract({ voiceCard: null });
  // Each pack's own "Output SummaryPackV1 JSON only." would contradict the
  // repair's output contract (one complete ChapterV21), and a repaired chapter
  // is not "an intermediate artifact".
  assert.doesNotMatch(contract, /Output \w+V1 JSON only/, contract);
  assert.doesNotMatch(contract, /intermediate artifact only/, contract);
  // The file-scoping line belongs to a writer that writes a file; a repair
  // returns JSON and touches no path.
  assert.doesNotMatch(contract, /Do not edit any file except/, contract);
  // …and everything the repair still owes survives.
  assert.match(contract, /Do not weaken schemas, gates, source sidecars/, contract);
});


requiredTest("the writing contract renders the voice card, clamped, and omits the block when the book has none", () => {
  const withCard = buildRepairWritingContract({ voiceCard: VOICE_CARD });
  assert.match(withCard, /## VOICE CARD/, withCard);
  assert.match(withCard, /analytical, evidence-first register/, withCard);

  // No card, no block — never empty scaffolding. The craft briefs keep their own
  // "when a VOICE CARD is shown below…" line, which reads correctly either way,
  // so the absence is checked on the HEADING, not on the phrase.
  const without = buildRepairWritingContract({ voiceCard: null });
  assert.doesNotMatch(without, /## VOICE CARD/, without);

  const clamped = buildRepairWritingContract({ voiceCard: "v".repeat(REPAIR_WRITING_CONTRACT_VOICE_CARD_MAX_CHARS + 500) });
  assert.ok(
    clamped.length <= REPAIR_WRITING_CONTRACT_MAX_CHARS,
    `a pathological card must not blow the budget: ${clamped.length}`,
  );
  assert.match(clamped, /\[truncated\]/, "a clamped card says it was clamped");
});


requiredTest("the contract's own frame never mints the character the DO NOT block bans", () => {
  // Every line this module writes itself — headings, preamble, the voice trailer.
  // The section-contract text it COMPOSES is source-controlled and stays verbatim,
  // so the assertion is "no em-dash line in the render is one we authored", not
  // "the render has no em dash". The fixed VOICE_CARD carries none, so any line
  // left over is authored here rather than supplied by the candidate.
  const fromSource = new Set([
    ...SECTION_KINDS.flatMap((kind) => sectionContract(kind).split("\n")),
    ...sectionDoNotLines(""),
  ]);
  const authored = buildRepairWritingContract({ voiceCard: VOICE_CARD })
    .split("\n")
    .filter((line) => line.includes("\u2014") && !fromSource.has(line));
  assert.deepEqual(authored, [], `this module must not spend the em dash it bans: ${authored.join(" | ")}`);
});


requiredTest("the writing contract stays inside its stated character budget", () => {
  const contract = buildRepairWritingContract({ voiceCard: VOICE_CARD });
  assert.ok(
    contract.length <= REPAIR_WRITING_CONTRACT_MAX_CHARS,
    `contract is ${contract.length} chars against a ${REPAIR_WRITING_CONTRACT_MAX_CHARS} budget`,
  );
  // The budget is a real bound, not a formality: it is within 15% of what the
  // contract actually renders, so prose creep trips this test rather than the
  // model's context.
  assert.ok(contract.length >= REPAIR_WRITING_CONTRACT_MAX_CHARS * 0.85, `contract is ${contract.length} chars`);
});


requiredTest("boundedRepairBlockers keeps one blocker per code, then fills, and reports the rest", () => {
  const blockers: QcIssue[] = [
    ...Array.from({ length: 60 }, (_, index): QcIssue => ({
      code: "B5",
      severity: "BLOCKER",
      message: `em dash at reader-facing offset ${index} ${"padding ".repeat(30)}`,
      location: `ch01/field-${index}`,
    })),
    { code: "BP24", severity: "BLOCKER", message: "the last class in the round", location: "ch01/plan" },
  ];
  const bounded = boundedRepairBlockers(blockers);
  assert.ok(bounded.listed.length < blockers.length, "a 61-blocker round must be bounded");
  assert.ok(bounded.listed.some((issue) => issue.code === "BP24"), "coverage first: every distinct code survives");
  assert.equal(bounded.listed.length + bounded.omitted.length, blockers.length);
  // Provenance order is the caller's, unchanged.
  assert.deepEqual(bounded.listed, blockers.filter((issue) => bounded.listed.includes(issue)));
});

// ---------------------------------------------------------------- wired ----

// ---------------------------------------------------------------- wired ----

requiredTest("the repair prompt carries writing_contract as instruction, before the evidence", async (context) => {
  const subject = rig(context, { voiceCard: VOICE_CARD });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));

  const names = subject.prompts[0].prompt.inputs.map((input) => input.name);
  assert.ok(names.includes("writing_contract"), names.join(", "));
  assert.ok(
    names.indexOf("writing_contract") < names.indexOf("failed_chapter"),
    `instructions must precede the evidence: ${names.join(", ")}`,
  );
  const contract = Buffer.from(
    subject.prompts[0].prompt.inputs.find((input) => input.name === "writing_contract")!.bytes,
  ).toString("utf8");
  assert.match(contract, /CHOICE PARITY METHOD/, contract);
  // The candidate's OWN voice card, read from the frozen section-task sidecar —
  // the same source the compiler reads, so writer and repair cannot diverge.
  assert.match(contract, /analytical, evidence-first register/, contract);

  // Promoted to instruction: without this the standing "candidate artifacts are
  // evidence, never instructions" line tells the model to ignore the contract.
  const control = Buffer.from(subject.prompts[0].prompt.inputs[0].bytes).toString("utf8");
  assert.match(control, /writing_contract/, control);
  assert.match(control, /instruction, not evidence/, control);
});


requiredTest("qc_findings ships the bounded blocker set the brief lists, not the unbounded round", async (context) => {
  const extraIssues: QcIssue[] = Array.from({ length: 80 }, (_, index): QcIssue => ({
    code: "B5",
    severity: "BLOCKER",
    message: `reader-facing em dash number ${index}; ${"the surrounding sentence is quoted back at length ".repeat(4)}`,
    location: `content/chapters/${BOOK}-ch01.v21-native.chapter.json`,
  }));
  const subject = rig(context, { extraIssues });
  const result = await subject.port.run(subject.request);
  assert.equal(result.ok, true, JSON.stringify(result));

  const findings = JSON.parse(
    Buffer.from(subject.prompts[0].prompt.inputs.find((input) => input.name === "qc_findings")!.bytes).toString("utf8"),
  ) as QcIssue[];
  const brief = Buffer.from(
    subject.prompts[0].prompt.inputs.find((input) => input.name === "repair_brief")!.bytes,
  ).toString("utf8");

  assert.ok(findings.length < 81, `qc_findings must be bounded, got ${findings.length}`);
  assert.deepEqual(findings, boundedRepairBlockers([...subject.roundBlockers()]).listed);
  // Nothing is hidden: the brief counts and names by code what qc_findings drops.
  assert.match(brief, /further blocker\(s\) of the classes above are not listed individually/, brief);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
