/**
 * Brief sanitizer.
 *
 * The on-disk BookBrief contains `forbiddenMoves` and `voiceCharter.avoidMoves`
 * arrays where each item is a natural-language instruction. Some of those
 * instructions necessarily contain the literal phrases the writer must avoid
 * ("the chapter", "the book", "Chapter N", banned house phrases, etc.) so the
 * editor-in-chief can name what to avoid.
 *
 * The system prompt for each writer already enforces those forbidden phrases.
 * Re-listing them in the brief multiplies the model's exposure to the very
 * tokens it must not echo, which we have observed reverse-priming the writer
 * (it produces the forbidden phrase instead of avoiding it).
 *
 * This sanitizer returns a clone of the brief with avoidMoves / forbiddenMoves
 * items that contain literal forbidden phrasing FILTERED OUT. The brief on
 * disk is never modified. Items that contain real, useful guidance unrelated
 * to the forbidden vocabulary are preserved.
 */
import type { BookBrief } from "../types.js";

/**
 * Phrases whose mere presence in the writer's prompt context risks
 * reverse-priming the model. If an avoidMoves / forbiddenMoves item literally
 * contains any of these substrings, the item is dropped before the writer
 * sees the brief. The system prompt enforces them already.
 */
const REVERSE_PRIMING_PHRASES = [
  "the chapter",
  "this chapter",
  "the author",
  "the book",
  "the law",
  "in this chapter",
  "Chapter 1",
  "Chapter 2",
  "Chapter 3",
  "Chapter N",
  // Banned house phrases
  "boundary condition",
  "keeps the chapter honest",
  "strips away",
  "is not decorative",
  "is not magic",
  "operating logic",
  "diagnostic discipline",
  "durable practice",
  "turns out to be",
  "That matters because",
];

function containsReversePrimingPhrase(item: string): boolean {
  const lower = item.toLowerCase();
  for (const phrase of REVERSE_PRIMING_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return true;
  }
  return false;
}

function filterArray(items: string[] | undefined): string[] | undefined {
  if (!items) return items;
  return items.filter((item) => !containsReversePrimingPhrase(item));
}

/**
 * Returns a deep-enough clone of the brief with reverse-priming items removed
 * from avoidMoves / forbiddenMoves arrays. Other fields are preserved.
 */
export function sanitizeBriefForWriter(brief: BookBrief): BookBrief {
  return {
    ...brief,
    forbiddenMoves: filterArray(brief.forbiddenMoves) ?? [],
    voiceCharter: {
      ...brief.voiceCharter,
      avoidMoves: filterArray(brief.voiceCharter?.avoidMoves) ?? [],
      signatureMoves: brief.voiceCharter?.signatureMoves ?? [],
    },
  };
}

/**
 * Final-line defense for any writer whose user prompt is built by stringifying
 * upstream JSON (brief, plan, breakdown). Even after the brief is sanitized,
 * the plan or other dumps can leak meta-tells into the writer's attention. This
 * runs over the assembled user-prompt string and drops entire lines that
 * contain any of the reverse-priming phrases — analogous to source-loader's
 * meta-stripping. Used by the cards writer (B9 / B10 hardening).
 */
export function sanitizeUserPromptForWriter(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept = lines.filter((line) => !containsReversePrimingPhrase(line));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}
