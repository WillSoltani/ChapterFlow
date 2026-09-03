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
 */
export const REPAIR_WRITING_CONTRACT_MAX_CHARS = 21700;

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
 * Render the repair writer's contract.
 *
 * Pure and deterministic: same voice card in, same bytes out. Takes no book id
 * and reads no file — the caller supplies the card it already read from the
 * candidate, so this module cannot make a repair irreproducible.
 */
export function buildRepairWritingContract(input: Readonly<{ voiceCard: string | null }>): string {
  const blocks = [
    PREAMBLE,
    ...SECTION_KINDS.map(packSection),
    doNotSection(),
    voiceSection(input.voiceCard),
  ].filter((block) => block !== "");
  return `${blocks.join("\n\n")}\n`;
}
