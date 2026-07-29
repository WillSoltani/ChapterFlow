import type { SummaryPackV1 } from "../artifacts/artifactTypes.js";

/**
 * Task 11ai — THIS chapter's own reader-visible prose, shared by the learning-pack
 * WRITER card (sectionTasks.buildSectionTaskMarkdown) and the SEC120 derivability
 * GATE (sectionGate.learningProseDerivabilityFindings) so the two can never drift.
 *
 * Finding 45: the four section packs are drafted INDEPENDENTLY from one source
 * packet, so the learning writer sees every allowed fact/anchor rather than the
 * SUBSET the summary writer actually put on the page. The blind 3-seat reader panel
 * failed every canary chapter on that one class — quiz stems and review cards naming
 * "Dr. Thomas Bond", "1751", "Temperance" that appear nowhere in the Fast/Deep/Full
 * read. The compile order is summary → example → learning → action, so by the time
 * the learning pack is drafted this prose EXISTS: it can be shown to the writer and
 * checked by the gate.
 *
 * The prose is the reader-visible summary-pack surface only: hook (+ its
 * counterintuition, which the reader also sees), all three read tiers, and the
 * keyTakeaway. Examples/actions are deliberately excluded — a quiz must be derivable
 * from what the READER READS as the chapter, not from a fictional scene.
 */
export type ChapterProseSource = Readonly<{
  hook?: unknown;
  breakdown?: unknown;
  keyTakeaway?: unknown;
}>;

export type ChapterProseFields = Readonly<{
  hook: string;
  counterintuition: string;
  fastRead: string;
  deepRead: string;
  fullRead: string;
  keyTakeaway: string;
}>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The drafted prose fields, each "" when unavailable. Tolerates a partially-drafted
 *  or loosely-typed summary pack (the compiler holds it as raw model output). */
export function chapterProseFields(source: ChapterProseSource | SummaryPackV1 | null | undefined): ChapterProseFields {
  const hook = record((source as ChapterProseSource | null | undefined)?.hook);
  const breakdown = record((source as ChapterProseSource | null | undefined)?.breakdown);
  return Object.freeze({
    hook: str(hook.hook),
    counterintuition: str(hook.counterintuition),
    fastRead: str(breakdown.fastRead),
    deepRead: str(breakdown.deepRead),
    fullRead: str(breakdown.fullRead),
    keyTakeaway: str((source as ChapterProseSource | null | undefined)?.keyTakeaway),
  });
}

/** Every drafted passage joined into one haystack; "" when nothing was drafted (the
 *  signal every consumer treats as "no prose available" and no-ops on). */
export function chapterProseText(source: ChapterProseSource | SummaryPackV1 | null | undefined): string {
  const fields = chapterProseFields(source);
  return [fields.hook, fields.counterintuition, fields.fastRead, fields.deepRead, fields.fullRead, fields.keyTakeaway]
    .filter((passage) => passage.length > 0)
    .join("\n");
}

/** Case/punctuation-insensitive normalisation used on BOTH sides of every
 *  derivability comparison, so "Dr. Thomas Bond" in a stem matches "Dr Thomas Bond"
 *  (or a curly-quoted / hyphenated variant) in the prose. */
export function normalizeProseText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
