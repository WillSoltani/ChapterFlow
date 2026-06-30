/**
 * Deterministic guard against FABRICATED model-reviewer findings.
 *
 * A model-judged QC role (sweep/bar/confirm) can hallucinate a defect the
 * deterministic gates can't see. The-daily-stoic round r20260615053335 shipped a
 * sweep finding claiming `implementationPlan.challenge` was duplicated verbatim
 * into `implementationPlan.twentyFourHourChallenge` across all 12 chapters — but
 * there is NO `challenge` field in the schema (0/12 chapters have one). It was a
 * pure invention that nonetheless set sweep=FAIL on every chapter and inflated the
 * repair list by ~13 items.
 *
 * This catches that class deterministically: a finding that cites a dotted
 * `<container>.<field>` path where the container is a real ChapterV21 container
 * but the field does NOT exist is fabricated. Conservative by design — it only
 * inspects KNOWN containers, so a finding that doesn't name a dotted field path
 * (or names an unknown container) is never rejected.
 *
 * A SECOND fabrication class (the-power-of-full-engagement): a cross-chapter SWEEP
 * finding can describe a real-sounding pattern but QUOTE a PARAPHRASED COMPOSITE
 * that exists in none of the chapters it names (R3 scene_skeleton quoted "Halfway
 * through, she sees the error" — 0 occurrences in the named chapters). The
 * path-based guard can't see it (the quote names no dotted field), so an
 * un-checkable book-wide finding gates the whole book and re-demotes content-
 * unchanged carried chapters. `quoteUnverifiableAgainstChapters` closes it by
 * substring-verifying the quote against the named chapters' actual text — but only
 * when the caller supplies that text, and only for sweep families.
 */

import { SWEEP_FAMILIES } from "./schemas.js";
import type { SubmissionFinding } from "./schemas.js";

/** Real fields per ChapterV21 container. A `<container>.<field>` reference whose
 *  field is absent here (for a listed container) is a fabricated unit. */
const CONTAINER_FIELDS: Record<string, ReadonlySet<string>> = {
  implementationPlan: new Set(["coreSkill", "twentyFourHourChallenge", "weeklyPractice", "ifThenPlans", "title"]),
  breakdown: new Set(["fastRead", "deepRead", "fullRead"]),
  planSpec: new Set(["domain", "audience", "stakes", "format", "requiredBeat", "venue", "exemplar"]),
  quiz: new Set(["questions", "prompt", "choices", "explanation", "correctIndex", "bloomsLevel"]),
  example: new Set(["scenario", "whatToDo", "whyItMatters", "title", "planSpec", "tags"]),
  examples: new Set(["scenario", "whatToDo", "whyItMatters", "title", "planSpec", "tags"]),
  reviewCard: new Set(["front", "back"]),
  reviewCards: new Set(["front", "back"]),
  memorableLine: new Set(["text"]),
  memorableLines: new Set(["text"]),
};

// Matches `container.field` OR `container.<subscript>.field`, where <subscript> is a
// numeric (`0`) or id-like (`ex01`) ARRAY ELEMENT reference. When a subscript is
// present we validate the FINAL field, not the subscript — so a reviewer citing a real
// defect as `examples.ex01.scenario` is no longer mis-flagged as fabricated (the
// subscript `ex01` is not a `examples` field, but `scenario` is). The true 2-level
// catch (`implementationPlan.challenge` — a field that genuinely does not exist) is
// preserved.
const PATH_RE = /\b([a-zA-Z]+)\.(?:(?:\d+|[a-zA-Z]+\d+)\.)?([a-zA-Z][a-zA-Z0-9]*)\b/g;

/** Finding fields the fabrication checks read. unitId/quote/problem/expectedFix
 *  drive the field-path check; repairClass/chapters (optional) drive the sweep
 *  quote-verification check. */
export type FabricationCheckFinding =
  Pick<SubmissionFinding, "unitId" | "quote" | "problem" | "expectedFix">
  & Partial<Pick<SubmissionFinding, "repairClass" | "chapters">>;

/** A reason string when the finding is fabricated (cites a non-existent field, OR —
 *  when `opts.getChapterText` is supplied — is a sweep finding whose quote appears in
 *  none of the chapters it names), else null. */
export function citesNonexistentField(
  finding: FabricationCheckFinding,
  opts?: { getChapterText?: (chapterNumber: number) => string | undefined },
): string | null {
  const text = [finding.unitId, finding.quote, finding.problem, finding.expectedFix].filter(Boolean).join("  ");
  PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_RE.exec(text)) !== null) {
    const container = m[1];
    const field = m[2];
    const allowed = CONTAINER_FIELDS[container];
    if (!allowed) continue;
    // A bare array-element subscript in field position (`examples.ex01`, `item3`) is
    // an element reference, not a field claim — never fabricated.
    if (/^[a-zA-Z]+\d+$/.test(field)) continue;
    if (!allowed.has(field)) return `${container}.${field}`;
  }
  // Paraphrased-composite sweep finding: the quote names no dotted field but cannot
  // be located in any chapter it names. Only runs when the caller passes chapter text.
  if (opts?.getChapterText && quoteUnverifiableAgainstChapters(finding, opts.getChapterText)) {
    return `unverifiable-quote:${finding.unitId || finding.repairClass || "sweep"}`;
  }
  return null;
}

/** True when EVERY finding is fabricated (cites a non-existent field, or — with
 *  `opts.getChapterText` — an unverifiable sweep quote) — i.e. the submission provides
 *  no valid evidence. Empty list → false (no claim made). */
export function allFindingsFabricated(
  findings: ReadonlyArray<FabricationCheckFinding>,
  opts?: { getChapterText?: (chapterNumber: number) => string | undefined },
): boolean {
  return findings.length > 0 && findings.every((f) => citesNonexistentField(f, opts) !== null);
}

const SWEEP_FAMILY_SET: ReadonlySet<string> = new Set<string>(SWEEP_FAMILIES);

/** Minimum normalized length for a quote segment to count as DISCRIMINATING. Shorter
 *  fragments (a bare character name like "genevieve") neither prove nor disprove a
 *  finding, so they are ignored — only substantial phrases are tested. */
const MIN_DISCRIMINATING_SEGMENT = 20;

/** Lowercase + reduce every run of non-alphanumerics to a single space. Punctuation
 *  and quote style are erased on BOTH sides, so a real verbatim cite still matches
 *  while a paraphrased composite does not. */
function normalizeForMatch(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Collect every string VALUE (never keys) from a nested object/array. */
function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") { out.push(node); return; }
  if (Array.isArray(node)) { for (const v of node) collectStrings(v, out); return; }
  if (node && typeof node === "object") { for (const v of Object.values(node)) collectStrings(v, out); }
}

/** All reader-facing text of a chapter, normalized for substring matching.
 *  Schema-agnostic (walks every string value) so it never drifts with ChapterV21. */
export function searchableChapterText(chapter: unknown): string {
  const parts: string[] = [];
  collectStrings(chapter, parts);
  return normalizeForMatch(parts.join("  "));
}

/** True when a CROSS-CHAPTER SWEEP finding's quote cannot be verified against ANY chapter
 *  it names — every discriminating (>= MIN length) ' / '-separated segment is absent (not
 *  a normalized substring) from every named chapter. Deliberately conservative: returns
 *  false (finding STANDS) for non-sweep findings, findings naming FEWER THAN 2 chapters
 *  (a single-chapter sweep finding is the chapter's own concern, never a book-wide
 *  membership-clobber — it gates normally), a quote with no long-enough segment, or when
 *  the named chapters can't be loaded — and a SINGLE real verbatim segment anywhere keeps
 *  the finding. It tests whole PHRASES (not tokens), so an incidental character-name match
 *  never blesses a fabricated finding. Scope = exactly the paraphrased book-wide composites
 *  that hold many chapters hostage (R3 scene_skeleton named 5, repeated_unit named 6). */
/** True when a quote has at least one DISCRIMINATING (>= MIN length) ' / '-separated
 *  segment present (as a normalized substring) in the given chapter text. Decides whether a
 *  SINGLE-chapter sweep finding is textually grounded in the chapter it names (the >= 2-chapter
 *  membership-clobber case is handled by quoteUnverifiableAgainstChapters). Fail-closed: a quote
 *  with no long-enough segment returns TRUE (grounded — we cannot disprove it, so it stands).
 *  Uses the SAME normalizer/threshold as the fabrication guard so the bar is identical. */
export function quoteGroundedInChapter(quote: string, chapterText: string): boolean {
  const segments = String(quote ?? "")
    .split(/\s*\/\s*/)
    .map(normalizeForMatch)
    .filter((s) => s.length >= MIN_DISCRIMINATING_SEGMENT);
  if (segments.length === 0) return true; // cannot disprove → grounded (fail-closed)
  const text = normalizeForMatch(chapterText);
  return segments.some((seg) => text.includes(seg));
}

/** Repetition families whose finding CLAIM is "a DISTINCTIVE unit is reused across chapters."
 *  Scoped deliberately: persona_drift (a reused character NAME) and location_stamping (a reused
 *  VENUE) legitimately anchor on short quotes, so they are excluded. */
const DISTINCTIVENESS_REQUIRED_FAMILIES: ReadonlySet<string> = new Set(["scene_skeleton", "repeated_unit"]);

/** True when a scene_skeleton / repeated_unit finding is anchored on a NON-DISTINCTIVE quote — one
 *  with no discriminating (>= MIN_DISCRIMINATING_SEGMENT normalized chars) segment. Such a quote is a
 *  short, common phrase (a tense auxiliary like "had already", a bare connective) that recurs across
 *  ANY corpus without indicating templating, so it is structurally incapable of proving distinctive
 *  reuse — a finding anchored on it must be surfaced but must NOT gate.
 *
 *  the-undoing-project r20260620130507-d0c017: three blocker repeated_unit findings quoting
 *  "had already" / "has already" / "was already" demoted 7/12 -> 1/12 — a book of entirely distinct
 *  scenes that merely share English past-perfect tense. NOT a QC loosening: a genuine >= 20-char
 *  distinctive reuse (real templating, a copy-pasted scene shell) still gates fully; this rejects only
 *  evidence that cannot support the claim it is attached to. Accepts the record (`family`) or repair
 *  (`repairClass`) shape. */
export function nondistinctiveRepetitionQuote(finding: { family?: string; repairClass?: string; quote?: string; chapters?: number[] }): boolean {
  const family = finding.family ?? finding.repairClass;
  if (!family || !DISTINCTIVENESS_REQUIRED_FAMILIES.has(family)) return false;
  // A repetition finding is a CROSS-CHAPTER reuse claim — it must name >= 2 chapters. A single-chapter
  // finding (or one with no chapter list) is a LOCAL defect, not a reuse claim; its quote length is
  // irrelevant to validity, so it is never "non-distinctive". (Guards against the sweep's repeated_unit
  // DEFAULT bucket swallowing a real single-chapter quiz/behavioral finding with a short quote.)
  if (!Array.isArray(finding.chapters) || finding.chapters.length < 2) return false;
  const hasDiscriminatingSegment = String(finding.quote ?? "")
    .split(/\s*\/\s*/)
    .map(normalizeForMatch)
    .some((seg) => seg.length >= MIN_DISCRIMINATING_SEGMENT);
  return !hasDiscriminatingSegment;
}

export function quoteUnverifiableAgainstChapters(
  finding: { repairClass?: string; chapters?: number[]; quote?: string },
  getChapterText: (chapterNumber: number) => string | undefined,
): boolean {
  if (!finding.repairClass || !SWEEP_FAMILY_SET.has(finding.repairClass)) return false;
  const chapters = finding.chapters ?? [];
  // Only book-wide (>= 2 named chapters) findings — the membership-clobber class. A
  // single-chapter sweep finding demotes only its own chapter and is left untouched.
  if (chapters.length < 2) return false;
  const segments = String(finding.quote ?? "")
    .split(/\s*\/\s*/)
    .map(normalizeForMatch)
    .filter((s) => s.length >= MIN_DISCRIMINATING_SEGMENT);
  if (segments.length === 0) return false;
  const texts = chapters
    .map((n) => getChapterText(n))
    .filter((t): t is string => typeof t === "string" && t.length > 0);
  if (texts.length === 0) return false;
  return !segments.some((seg) => texts.some((t) => t.includes(seg)));
}
