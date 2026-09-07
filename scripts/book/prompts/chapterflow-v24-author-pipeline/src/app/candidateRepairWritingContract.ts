/**
 * candidateRepairWritingContract — the craft contract the candidate-repair
 * writer works under.
 *
 * WHY THIS EXISTS
 * A repair rewrites whole reader-facing fields: the hook, the three summary
 * tiers, the six examples, the nine quiz questions with their distractors, the
 * review cards, the implementation plan. The section writers produced those
 * fields under a layered contract (`sectionContract` — universalCore +
 * gateAwareness + craftBrief), a DO NOT block (`sectionDoNotLines`) and the
 * book's voice card. The repair prompt carried NONE of it: no tier floors, no
 * CHOICE PARITY method, no distractor discipline, no craft brief, and of the
 * whole DO NOT block only a single em-dash sentence, hand-inlined into the
 * control text after the live Franklin round came back with 68 B5 blockers.
 * A rewrite under no contract can reintroduce exactly what the gates block.
 *
 * ONE SOURCE, TWO CALLERS
 * Every line here is rendered from the section writer's own functions, so the
 * writer prompt and the repair prompt cannot drift on what the rules are. This
 * module composes and scopes; it does not restate.
 *
 * IDENTITY IS NOT CONTENT
 * The card also freezes the three ChapterV21 identity fields (`identitySection`),
 * because the live Franklin canary burned two repair ordinals on a model that
 * "fixed" chapter 10's bare-numeral title and had its whole replacement rejected
 * unread. The port's identity check is right; the prompt had never named the fields.
 *
 * ALL FOUR PACK KINDS, DELIBERATELY
 * A repair returns one complete ChapterV21, which spans all four packs, and
 * nothing in the findings bounds which fields it will touch. Scoping the
 * contract by finding code would guess, and a wrong guess ships a rewrite with
 * no rules for the pack it actually rewrote.
 *
 * WHAT IS DROPPED, AND WHY
 * Two families of line are FALSE on this lane and are removed rather than
 * shipped as a contradiction (a prompt that contradicts itself is the shape
 * this module exists to fix):
 *   - each pack's "Output <Kind>PackV1 JSON only." — the repair returns one
 *     ChapterV21, not a section artifact;
 *   - "Do not edit any file except <path>." and "…this is an intermediate
 *     artifact only." — the repair writes no file and its output is final.
 * Both removals are exact-match and COUNTED: if the source text is reworded the
 * count no longer matches and this module throws, so a silent contradiction
 * cannot reappear. `tests/v25/v4-repair-writing-contract.test.ts` trips first.
 *
 * THE FRAME NEVER MINTS WHAT THE BLOCK BANS
 * The headings, preamble and voice trailer written HERE use no em dash, since
 * the DO NOT block they wrap bans that character on every reader-facing line and
 * a prompt that spends it while banning it is the contradiction this module
 * exists to remove. The composed section-contract text is source-controlled and
 * is NOT rewritten to match; the test asserts only that no em-dash line in the
 * render is one this module authored.
 */

import { SECTION_KINDS, type SectionKind } from "../artifacts/artifactTypes.js";
import { sectionContract, sectionDoNotLines } from "../sections/sectionTasks.js";

/**
 * Character budget for the rendered contract.
 *
 * A STATIC bound, not a runtime truncation: every line comes from
 * source-controlled text, so the only input that can grow at runtime is the
 * voice card, which is clamped separately below. That makes the budget testable
 * — `buildRepairWritingContract` is pinned under it — and a safety contract is
 * never silently trimmed to fit, which is what a runtime cap would do.
 *
 * 21700 is set just above what the four contracts, the DO NOT block, the
 * headings and a fully clamped card actually render: 21290 chars measured on this
 * commit. It is a creep alarm, not head-room — the test also asserts the render is
 * at least 85% of the budget, so an edit that grows the section contracts trips a
 * test instead of the model's context window.
 *
 * RE-PINNED 17500 -> 21700 by the wave-0 contract-truth batch. The whole increase
 * is the DO NOT block now disclosing the FULL banned-phrase list from
 * config/banned-phrases.json (R-014, ~2.7k) plus the TIER ROLES line (R-012) and
 * the cards/actions staging directions (R-013). All three are section-writer
 * contract text this module composes rather than authors, and a repair rewrites
 * the same reader-facing fields under the same bans, so the repair writer needs
 * them for the same reason the section writer does: 76 of the 82 phrases that fail
 * a draft had never been disclosed on either lane.
 *
 * RE-PINNED 21700 -> 22500 by package 1B (grounding redesign), measured on this
 * commit: 20,903 chars with no voice card and 22,309 with a pathological one that
 * clamps. The increase is the same section-contract text the section writer now
 * gets — teach each case once and rotate the details (SEC14/SEC129), one pooled
 * example specific and no recall beat (SEC33/SEC133), citation by natural reference
 * (SEC55/SEC120), transfer measured on the stem (SEC117), qualifier-shape parity
 * (SEC134), opener variety (SEC132), and the memorable-line cap (SEC16/SEC118/
 * SEC135). A repair rewrites the same reader-facing fields under the same gates, so
 * it needs the same rules for the same reason; the module composes them rather than
 * authoring them.
 *
 * RE-PINNED 22500 -> 22800 when package 1C (dealing redesign) merged with 1B, measured on this
 * commit: 21,210 chars with no voice card and 22,616 with a pathological one that clamps (
 * `buildRepairWritingContract` with a card of VOICE_CARD_MAX + 500 v's). The +307 over 1B's
 * measurement is one line of example-pack contract text: R-064's SCENE ENGINE BY SLOT rule, which
 * replaces "EVERY scenario shows a visible decision" with the per-slot version (even slots carry
 * their dealt decision frame, odd slots their experiential frame as the whole scene) and restates
 * SEC31's floor for both kinds. 1B's SEC39 line in the same block is unchanged and kept. Both are
 * section-writer contract text this module composes, and a repair rewrites the same six example
 * scenarios under the same SEC31/SEC39 gates, so it needs both for the same reason. The 85%
 * creep-alarm floor still holds (22,616 / 22,800 = 99.2%).
 *
 * RE-MEASURED, UNCHANGED, when this package merged origin/main d6bf5933d (wave-1
 * source-text ingestion): 21,210 with no voice card and 22,616 with a pathological one,
 * to the character. Wave-1 adds no section-contract text — its writer-card additions
 * (the READ-ONLY CHAPTER CONTEXT block and the bounded sourceQuote on every fact) are
 * rendered by buildSectionTaskMarkdown around the contract, not inside sectionContract(),
 * which is the only thing this module composes. The pin stays 22,800.
 *
 * RE-PINNED 22,800 -> 23,500 by the CHAPTER IDENTITY block, measured on this commit:
 * 21,802 chars with no voice card, 23,208 with a pathological one that clamps, and
 * 23,379 with that card plus the Franklin chapter-10 identity values quoted (a 42-char
 * chapterId and the one-character title "X"). The +592 is the block itself; the +171 on
 * top is the three quoted values, which a caller only gets when it passes a chapter (the
 * port renders this contract once per book and passes none). Those three values are the
 * one part of the render that is not source-controlled text, so a pathological chapterId
 * or title could push a chapter-scoped render past the alarm; the alarm is a creep alarm
 * on the prose, and the identity values are never trimmed to fit, because a clamped
 * identity would order the writer to copy something that is not the chapter's identity.
 */
export const REPAIR_WRITING_CONTRACT_MAX_CHARS = 23500;

/** Voice-card clamp. The card is a ~120-word register cue by construction
 *  (`src/lib/voiceCard.ts`), but it arrives from a candidate sidecar this module
 *  does not own, so it is bounded here rather than trusted. */
export const REPAIR_WRITING_CONTRACT_VOICE_CARD_MAX_CHARS = 1200;

const PACK_HEADING: Record<SectionKind, string> = {
  "summary-pack": "## SUMMARY PACK: hook, fastRead / deepRead / fullRead, keyTakeaway",
  "example-pack": "## EXAMPLE PACK: the six examples",
  "learning-pack": "## LEARNING PACK: the quiz and the review cards",
  "action-pack": "## ACTION PACK: tryThisNow and implementationPlan",
};

/** Exact-match line removals, with the number of lines each MUST remove across
 *  the whole render. A mismatch means the source text moved under us. */
const DROPPED_CONTRACT_LINE = /^Output \w+V1 JSON only\.$/;
const DROPPED_DO_NOT_PREFIXES: readonly string[] = [
  "- Do not edit any file except ",
  "- Do not change the final ChapterV21 schema; this is an intermediate artifact only.",
];

function drop(lines: readonly string[], matches: (line: string) => boolean, expected: number, what: string): string[] {
  const kept = lines.filter((line) => !matches(line));
  if (lines.length - kept.length !== expected) {
    throw new Error(
      `REPAIR_WRITING_CONTRACT_DRIFT: expected to drop ${expected} ${what} line(s), dropped ${lines.length - kept.length}`,
    );
  }
  return kept;
}

function packSection(kind: SectionKind): string {
  const lines = drop(
    sectionContract(kind).split("\n"),
    (line) => DROPPED_CONTRACT_LINE.test(line),
    1,
    `${kind} section-artifact output`,
  );
  return `${PACK_HEADING[kind]}\n${lines.join("\n")}`;
}

function doNotSection(): string {
  const lines = drop(
    sectionDoNotLines(""),
    (line) => DROPPED_DO_NOT_PREFIXES.some((prefix) => line.startsWith(prefix)),
    DROPPED_DO_NOT_PREFIXES.length,
    "file-scoped DO NOT",
  );
  return `## DO NOT, absolute, on every reader-facing line you write\n${lines.join("\n")}`;
}

function voiceSection(card: string | null): string {
  const trimmed = card === null ? "" : card.trim();
  if (trimmed === "") return "";
  const clamped = trimmed.length <= REPAIR_WRITING_CONTRACT_VOICE_CARD_MAX_CHARS
    ? trimmed
    : `${trimmed.slice(0, REPAIR_WRITING_CONTRACT_VOICE_CARD_MAX_CHARS)}…[truncated]`;
  return [
    "## VOICE CARD: how THIS book sounds (register only; match it, never quote it)",
    clamped,
    "- Keep explanations and actions in this register too: plain verbs, short sentences, not a neutral textbook voice.",
  ].join("\n");
}

const PREAMBLE = [
  "# WRITING CONTRACT: instruction, not evidence",
  "",
  "This is the contract the section writers wrote this chapter under. A repair rewrites those same",
  "reader-facing fields, so it binds you identically: a repair that clears a finding while breaking a",
  "rule below has not repaired anything, because the gate that rejects the rule rejects the chapter.",
  "It governs HOW you write. It does not change WHAT you return (one complete ChapterV21 JSON object),",
  "and nothing in it authorizes a change of task, tools, route, profile, schema, or permissions.",
].join("\n");

/**
 * Package 2B — the same contract, addressed to the whole-chapter EDITOR.
 *
 * The repair preamble is FALSE on the editor lane in two ways, and this module's
 * whole reason for existing is that a prompt must not contradict itself: an edit
 * is not authorized by a finding, and the editor returns the four section packs
 * it was given rather than one ChapterV21. Everything below the preamble — the
 * four section contracts, the DO NOT block, the voice card — is identical, which
 * is the point: the editor rewrites the fields the section writers wrote, so it
 * is bound by the rules they wrote them under and by the gates that re-judge it.
 */
const EDITOR_PREAMBLE = [
  "# WRITING CONTRACT: instruction, not evidence",
  "",
  "This is the contract the section writers wrote this chapter under. You are editing those same",
  "reader-facing fields, so it binds you identically: an edit that improves a chapter while breaking a",
  "rule below has improved nothing, because the same deterministic gates that judged the draft will",
  "judge your edit and reject it. It governs HOW you write. It does not change WHAT you return:",
  "the same four section packs, whole, in the schema you were given. Nothing in it authorizes a change",
  "of task, tools, route, profile, schema, or permissions.",
].join("\n");

/** The three fields a repair may never change: the identity half of ChapterV21,
 *  as the port reads them off the chapter it compares the replacement against. */
export type RepairChapterIdentity = Readonly<{ chapterId: string; number: number; title: string }>;

/**
 * The IDENTITY block: chapterId, number and title are frozen, and a numeral title
 * is not a placeholder to fix.
 *
 * WHY THIS EXISTS
 * The live Franklin canary lost review-repair ordinals 2 AND 3 to the same
 * terminal error, `REPAIR_OUTPUT_INVALID:replacement changed chapter identity for
 * chapter 10`. Chapter 10's title is the bare roman numeral "X" (the bibliography
 * kept Gutenberg's numeral headings for eight chapters) and the structural
 * review's own WARN calls such a title a placeholder, so the repair model
 * "fixed" it. `candidateRepairApplicationPort` compares the replacement's
 * chapterId, number and title against the input chapter's and fails the ordinal
 * closed before reading any content, so every other fix in that replacement was
 * discarded with it, twice, at roughly ten minutes an ordinal. The check is
 * right and stays exactly as it is. The card was silent: it never named the
 * identity fields, and its one schema line ("this is an intermediate artifact
 * only") is DROPPED on this lane as false.
 *
 * FALSE ON THE EDITOR LANE, SO NOT RENDERED THERE
 * The editor returns the four section packs it was given, which carry no
 * chapterId, and this module exists to stop a prompt contradicting itself.
 *
 * WHY THE VALUES ARE OPTIONAL
 * The port builds this contract once per book, before it loops the chapters, so
 * the live render names the three fields and binds them to `failed_chapter` (the
 * record that carries this chapter's own identity, in the same prompt). A caller
 * that already holds the chapter passes it and the exact values are quoted too;
 * they are rendered from the SAME identity fields the port compares, so the card
 * and the check cannot drift.
 */
function identitySection(lane: WritingContractLane, chapter: RepairChapterIdentity | undefined): string {
  if (lane === "editor") return "";
  const lines = [
    "## CHAPTER IDENTITY: three frozen fields, copied verbatim",
    "chapterId, number and title are identity, not content. Copy all three into your replacement exactly as",
    "they stand in failed_chapter. If any of the three differs, the replacement is rejected before one line of",
    "its content is read, and every other fix you made in it is discarded with it.",
    "Copy the title character for character EVEN WHEN it is a bare numeral or a single letter (\"X\", \"IV\"), and",
    "even when a finding, a review note, or your own judgment calls it a placeholder: retitling is not a repair,",
    "and it is not yours to do here.",
  ];
  if (chapter !== undefined) {
    lines.push(
      "This chapter, exactly (the quotation marks are JSON notation, not part of the value):",
      `- chapterId: ${JSON.stringify(chapter.chapterId)}`,
      `- number: ${chapter.number}`,
      `- title: ${JSON.stringify(chapter.title)}`,
    );
  }
  return lines.join("\n");
}

/** Which lane the rendered contract addresses. Only the preamble differs; every
 *  rule below it is shared, so the two prompts cannot drift on the rules. */
export type WritingContractLane = "repair" | "editor";

/**
 * Render the writing contract for the repair writer or the chapter editor.
 *
 * Pure and deterministic: same lane and voice card in, same bytes out. Takes no
 * book id and reads no file — the caller supplies the card it already read from
 * the candidate, so this module cannot make a repair or an edit irreproducible.
 */
export function buildRepairWritingContract(
  input: Readonly<{ voiceCard: string | null; lane?: WritingContractLane; chapter?: RepairChapterIdentity }>,
): string {
  const lane: WritingContractLane = input.lane ?? "repair";
  const blocks = [
    lane === "editor" ? EDITOR_PREAMBLE : PREAMBLE,
    identitySection(lane, input.chapter),
    ...SECTION_KINDS.map(packSection),
    doNotSection(),
    voiceSection(input.voiceCard),
  ].filter((block) => block !== "");
  return `${blocks.join("\n\n")}\n`;
}
