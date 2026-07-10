/**
 * C36 — source-guide APPARATUS leakage (CF-J, 2026-07-09). The radical-candor
 * release-readiness direct read (docs/v24/V24_RADICAL_CANDOR_RELEASE_READINESS_REVIEW.md
 * §7) found a leakage class BELOW the C31–C35 detectors: the source guide's own
 * apparatus narrated to the reader across 7/9 chapters — page citations in reader
 * prose ("the organization tied to SBI on Ch. 6 p. 138", "On page 33, Radical
 * Candor names…"), guide-structure narration ("The official guide puts Results in
 * Part 2", "the source guide's practice questions"), machinery vocabulary INSIDE
 * quiz surfaces (ch6 q01 "accepting page references as proof" / "The page span
 * points to delivery"), and drafting-spec sentences printed verbatim ("The outcome
 * is not claimed here. The proof is earlier.", "the blue calendar block is the
 * only hard detail").
 *
 * ROOT CAUSE (page citations): the research minted "Ch. N pp. N-M" locators INSIDE
 * packet fact/case TEXT (99 occurrences across the radical-candor packets), the
 * writer projection handed that text over as the only allowed factual material,
 * and the writer quoted it faithfully. The PREVENTION half lives in
 * stripPageCitationSpans below (consumed by compiler/sourcePacketProjection.ts and
 * compiler/chapterBrief.ts); C36 is the DETECTION half at the gate.
 *
 * FOUR categories, each at most ONE advisory finding per chapter (listing the
 * offending units), all MINOR — same posture as C31–C35: never in ENFORCED_MAJOR,
 * never wired to a gate/contract/acceptance predicate; the findings ride the
 * registerAdvisories repair routing (retry cards, review-repair directives, regen
 * attempt-1 cards).
 *
 *   C36.apparatus_page_citation  — "Ch. N p./pp. N(-M)( and K)" compounds, bare
 *       "p./pp. N" abbreviations, and the "on page N" locution. A book genuinely
 *       ABOUT pages/documents stays clean as long as it stages the page as a scene
 *       object ("she marked page 90 with a pencil") rather than a citation form.
 *   C36.apparatus_guide_structure — the guide's own layout narrated as subject/
 *       topic: "the official guide", "the source guide", "the (official) glossary",
 *       "the bonus unit/chapter", "discussion prompts", "practice questions".
 *       ("Part N" alone is NOT matched: the observed leaks all co-carry one of the
 *       phrases above, and bare Part-N is a legitimate way to discuss a source's
 *       argument. Extend the list here if a bare-Part-N leak is ever observed.)
 *   C36.apparatus_machinery_term — pipeline vocabulary: source packet, sidecar,
 *       planSpec, page anchor, case label, evidence slot, source lineage, page
 *       reference(s), page span(s), anchor id(s). Scans quiz/card surfaces too —
 *       the review found machinery inside quiz text. The discriminator is the
 *       TERM, not the position: a distractor teaching "accepting page references
 *       as proof" FIRES (it teaches pipeline vocabulary), while a distractor that
 *       legitimately names citing sources as a wrong move ("cite the original
 *       source in the meeting instead of acting") is spared.
 *   C36.apparatus_spec_narration — curated sentence patterns from the review's
 *       verbatim quotes: the fact-discipline hedge ("not claimed here", "the proof
 *       is earlier") and prop-budget specs narrating themselves ("the only hard
 *       detail", "one object was left"). Deliberately a small curated list — each
 *       entry is a confirmed reader-visible leak; extend it as new spec-narration
 *       quotes are confirmed by direct reads (this is the documented growth path,
 *       not a generic classifier).
 *
 * CALIBRATION (2026-07-09), measured over five corpora on the reader-facing
 * surface set below (chapters carrying >=1 finding, per category):
 *   gold start-with-why (state, 14 ch)   0 / 0 / 0 / 0
 *   the-culture-code    (state, 13 ch)   0 / 0 / 0 / 0
 *   HOM                 (package, 16 ch) 0 / 0 / 0 / 0
 *   multipliers         (package, 9 ch)  0 / 0 / 0 / 0
 *   radical-candor      (state, 9 ch)    6 / 5 / 2 / 3   ← the defect corpus;
 *       page_citation ch1/2/3/4/6/7, guide_structure ch3/4/7/8/9, machinery
 *       ch1/6 (incl. the ch6 q01 quiz units), spec_narration ch2/4/5.
 * The pins live in tests/apparatus-leakage.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate } from "./shared.js";

// ── Shared page-citation grammar (single source of truth) ─────────────────────
//
// Detection AND mint-removal read the same core pattern so the strip is always at
// least as broad as the detector for the compound/abbreviation forms.
//
//   "Ch. 6 pp. 137-141 and 152" · "Chapter 2, p. 33" · "pp. 47-48" · "p. 33"
const PAGE_CITE_CORE = String.raw`(?:Ch(?:apter)?\.?\s*\d+\s*,?\s*)?pp?\.\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s*(?:,|and|&)\s*\d+(?:\s*[-–—]\s*\d+)?)*`;
//   "on page 33" · "on pages 47-48"
const ON_PAGE_CORE = String.raw`on\s+pages?\s+\d+(?:\s*[-–—]\s*\d+)?(?:\s*(?:,|and|&)\s*\d+(?:\s*[-–—]\s*\d+)?)*`;

/** Detection form: does this text carry a page-citation span? */
export const PAGE_CITATION_RE = new RegExp(String.raw`\b(?:${PAGE_CITE_CORE}|${ON_PAGE_CORE})`, "i");

// Strip form: also consume a leading locator preposition ("documented AT Ch. 3
// pp. 47-48", "referenced at…") and a wrapping parenthesis, then tidy the seams.
const PAGE_CITATION_STRIP_RE = new RegExp(
  String.raw`\s*\(\s*(?:(?:at|in|see)\s+)?(?:${PAGE_CITE_CORE}|${ON_PAGE_CORE})\s*\)|(?:\b(?:at|in)\s+)?\b(?:${PAGE_CITE_CORE}|${ON_PAGE_CORE})`,
  "gi",
);

/**
 * Mint-removal: delete every page-citation span from `text` and tidy the
 * whitespace / orphaned punctuation the deletion leaves behind ("…Leadership
 * and Ch. 6 p. 138." → "…Leadership."). Pure; returns "" when the text WAS a
 * citation ("Ch. 3 pp. 47-48"). The raw packet/sidecar on disk is never touched —
 * callers apply this only to PROJECTED text (writer card, brief lines).
 */
export function stripPageCitationSpans(text: string): string {
  if (typeof text !== "string" || !text) return typeof text === "string" ? text : "";
  if (!PAGE_CITATION_RE.test(text)) return text;
  return text
    .replace(PAGE_CITATION_STRIP_RE, " ")
    // an orphaned connective left dangling before punctuation: "…Leadership and ." → "…Leadership."
    .replace(/\s+(?:and|&|,|;|:)\s*(?=[.,;:!?])/gi, "")
    // connective orphaned at end-of-text: "documented at" already consumed; "…and" tail
    .replace(/\s+(?:and|&)\s*$/i, "")
    // punctuation seams: " ." → ".", " ," → ",", ",." → "."
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([,;:])\s*([.,;:!?])/g, "$2")
    .replace(/\(\s*\)/g, "")
    // a citation stripped from the very front leaves an orphaned comma:
    // "On page 33, Radical Candor names…" → ", Radical Candor names…"
    .replace(/^\s*[,;:]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** True when the string IS a page citation (nothing content-bearing survives the
 *  strip) — e.g. the hardSpecifics entry "Ch. 6 p. 138". Used by the projection
 *  (drop the entry) and by sourceGrounding's SC11.2 tolerance (an internal
 *  coordinate can never be REQUIRED reader-visible text). Pure. */
export function isPageCitationOnly(text: string): boolean {
  if (typeof text !== "string" || !text.trim()) return false;
  if (!PAGE_CITATION_RE.test(text)) return false;
  return !/[a-z0-9]/i.test(stripPageCitationSpans(text));
}

// ── The other three category grammars ─────────────────────────────────────────

const GUIDE_STRUCTURE_RES: RegExp[] = [
  /\bthe (?:official|source) guide\b/i,
  /\bthe (?:official )?glossary\b/i,
  /\bthe bonus (?:unit|chapter)\b/i,
  /\bdiscussion prompts?\b/i,
  /\bpractice questions\b/i,
];

const MACHINERY_TERM_RES: RegExp[] = [
  /\bsource packets?\b/i,
  /\bsidecars?\b/i,
  /\bplan ?specs?\b/i,
  /\bpage anchors?\b/i,
  /\bcase labels?\b/i,
  /\bevidence slots?\b/i,
  /\bsource lineage\b/i,
  /\bpage references?\b/i,
  /\bpage spans?\b/i,
  /\banchor ids?\b/i,
];

// Curated from the review's verbatim quotes (§7 "spec-narration sentences printed
// verbatim"). Extensible: add a pattern per confirmed reader-visible quote.
const SPEC_NARRATION_RES: RegExp[] = [
  /\bnot claimed here\b/i,
  /\bthe proof is earlier\b/i,
  /\bthe only hard detail\b/i,
  /\bone object was left\b/i,
];

export type ApparatusCategory =
  | "page_citation"
  | "guide_structure"
  | "machinery_term"
  | "spec_narration";

const CATEGORIES: Array<{
  key: ApparatusCategory;
  checkId: string;
  res: RegExp[];
  fix: string;
}> = [
  {
    key: "page_citation",
    checkId: "C36.apparatus_page_citation",
    res: [PAGE_CITATION_RE],
    fix:
      "Page/section citations are the source guide's INTERNAL coordinates, never reader prose — strip each citation and keep the idea it locates (facts, quiz keys, and schema unchanged).",
  },
  {
    key: "guide_structure",
    checkId: "C36.apparatus_guide_structure",
    res: GUIDE_STRUCTURE_RES,
    fix:
      "The source guide's own structure is narrated to the reader — replace the structure-talk with the IDEA it points to (teach the concept, not where the guide shelves it).",
  },
  {
    key: "machinery_term",
    checkId: "C36.apparatus_machinery_term",
    res: MACHINERY_TERM_RES,
    fix:
      "Pipeline machinery vocabulary reached reader-facing text (including quiz/card surfaces) — remove the machinery term and say the plain thing it stands for; keep every fact, key, and schema field unchanged.",
  },
  {
    key: "spec_narration",
    checkId: "C36.apparatus_spec_narration",
    res: SPEC_NARRATION_RES,
    fix:
      "An internal drafting/spec constraint is narrated as reader prose — rewrite the sentence as a natural explanation of the scene (what happened and why it matters), not a note about what the text is allowed to claim.",
  },
];

/** EVERY reader-facing surface, including assessment surfaces — the review found
 *  machinery INSIDE quiz text (ch6 q01), so unlike C33's prose-only scope this
 *  scan covers quiz prompts/choices/explanations, review cards, and the full
 *  implementation plan. */
function readerFacingUnits(chapter: ChapterV21): Array<{ unit: string; text: string }> {
  const out: Array<{ unit: string; text: string }> = [];
  const add = (unit: string, text: unknown) => {
    if (typeof text === "string" && text) out.push({ unit, text });
  };
  add("hook", chapter.hook);
  add("counterintuition", chapter.counterintuition);
  add("tryThisNow", chapter.tryThisNow);
  add("keyTakeaway", chapter.keyTakeaway);
  add("breakdown.fastRead", chapter.breakdown?.fastRead);
  add("breakdown.deepRead", chapter.breakdown?.deepRead);
  add("breakdown.fullRead", chapter.breakdown?.fullRead);
  (chapter.examples ?? []).forEach((ex: any, i) => {
    const id = ex?.exampleId ?? `example[${i}]`;
    add(`${id}.title`, ex?.title);
    add(`${id}.scenario`, ex?.scenario);
    add(`${id}.whatToDo`, ex?.whatToDo);
    add(`${id}.whyItMatters`, ex?.whyItMatters);
  });
  (chapter.quiz?.questions ?? []).forEach((q: any, i) => {
    const id = q?.questionId ?? `q${String(i + 1).padStart(2, "0")}`;
    add(`quiz.${id}.prompt`, q?.prompt);
    (q?.choices ?? []).forEach((c: unknown, j: number) => {
      add(`quiz.${id}.choice[${j}]`, typeof c === "string" ? c : (c as { direct?: unknown })?.direct);
    });
    add(`quiz.${id}.explanation`, q?.explanation);
  });
  (chapter.reviewCards ?? []).forEach((c: any, i) => {
    const id = c?.cardId ?? `card[${i}]`;
    add(`${id}.front`, c?.front);
    add(`${id}.back`, c?.back);
  });
  const plan = chapter.implementationPlan;
  if (plan) {
    add("implementationPlan.title", plan.title);
    add("implementationPlan.coreSkill", plan.coreSkill);
    (plan.ifThenPlans ?? []).forEach((p: any, i) => {
      add(`implementationPlan.ifThen[${i}]`, `${p?.context ?? ""} ${p?.plan ?? ""}`.trim());
    });
    add("implementationPlan.twentyFourHourChallenge", plan.twentyFourHourChallenge);
    add("implementationPlan.weeklyPractice", plan.weeklyPractice);
  }
  (chapter.memorableLines ?? []).forEach((m: any, i) => add(`memorableLines[${i}]`, m?.text));
  return out;
}

export type ApparatusHit = { category: ApparatusCategory; unit: string; snippet: string };

/** Every reader-facing unit carrying an apparatus span, per category. Pure,
 *  deterministic, no disk; exported for direct calibration. */
export function findApparatusLeakage(chapter: ChapterV21): ApparatusHit[] {
  const hits: ApparatusHit[] = [];
  const units = readerFacingUnits(chapter);
  for (const { key, res } of CATEGORIES) {
    for (const { unit, text } of units) {
      const re = res.find((r) => r.test(text));
      if (!re) continue;
      const m = text.match(re);
      const at = m?.index ?? 0;
      hits.push({
        category: key,
        unit,
        snippet: text.slice(Math.max(0, at - 30), at + (m?.[0].length ?? 0) + 30).trim(),
      });
    }
  }
  return hits;
}

/**
 * C36 — ONE advisory finding per chapter per category, listing the offenders.
 * MINOR; never blocks (not in ENFORCED_MAJOR, not wired to any predicate).
 */
export function checkApparatusLeakage(chapter: ChapterV21): CriticFinding[] {
  const hits = findApparatusLeakage(chapter);
  if (hits.length === 0) return [];
  const findings: CriticFinding[] = [];
  for (const { key, checkId, fix } of CATEGORIES) {
    const mine = hits.filter((h) => h.category === key);
    if (mine.length === 0) continue;
    const listed = mine
      .slice(0, 4)
      .map((h) => `${h.unit} ("…${truncate(h.snippet, 70)}…")`)
      .join("; ");
    // The FIX DIRECTIVE leads: registerAdvisoryFixLines truncates each line to 260
    // chars for the retry/repair cards, and the repair instruction must survive the
    // cut — the offender list (which can run long) follows it.
    findings.push(
      finding(
        checkId as any,
        "minor",
        `${mine.length} reader-facing unit(s) carry source-guide apparatus [${key}]. ${fix} Offenders: ${listed}.`,
        truncate(mine[0].snippet, 120),
      ),
    );
  }
  return findings;
}
