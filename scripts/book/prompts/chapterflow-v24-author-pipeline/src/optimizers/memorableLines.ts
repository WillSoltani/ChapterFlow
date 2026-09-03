import { ChapterV21 } from "../types.js";
import { MemorableLine } from "../agents/memorable-lines.js";

const BAD_SNIPPETS = [
  "the chapter",
  "this chapter",
  "the book",
  "the author",
  "boundary condition",
  "That matters because",
];

const BAD_SHAPES = [
  /^\s*if\s+(?:not|so)\b/i,
  /^\s*the\s+(?:main\s+)?categories\s+are\b/i,
  /^\s*(?:ask|check|choose|decide|name|list|write|mark|use)\s+(?:whether|which|what|when|where|how)\b/i,
  /\bbalance sheets,\s*earnings,\s*and\s*catalysts\s+must\s+support\b/i,
  /\battention,\s*meaning,\s*or\s*memory\b/i,
];

/** The three breakdown tiers memorable lines are harvested from, in harvest order.
 *  Order is load-bearing: V8's sort is stable, so equal-scoring candidates keep
 *  their harvest order and the compile-time and ship-time selections coincide only
 *  while both harvest in this sequence. */
export const MEMORABLE_TIERS = ["fastRead", "deepRead", "fullRead"] as const;
export type MemorableTier = (typeof MEMORABLE_TIERS)[number];

/** One harvested memorable-line candidate. `ids` carries the tier's cited source
 *  anchors — the candidate inherits its WHOLE tier's citations, which is what the
 *  grounding check (SEC16 at compile, SC11.2 at ship) reads. */
export type MemorableCandidate = {
  readonly text: string;
  readonly score: number;
  readonly tier: MemorableTier;
  readonly ids: unknown;
};

/**
 * Harvest the scored candidates out of a chapter's three breakdown tiers.
 *
 * ONE harvest for both lanes. The section gate used to inline its own copy of this
 * split/score loop while the assembler kept another in `selectMemorableLinesDeterministic`;
 * two copies of "which sentences are candidates" is the first half of the write/ship
 * split this module now closes.
 */
export function harvestMemorableCandidates(
  breakdown: Partial<Record<MemorableTier, unknown>> | undefined | null,
  idsForTier: (tier: MemorableTier) => unknown = () => undefined,
): MemorableCandidate[] {
  const candidates: MemorableCandidate[] = [];
  for (const tier of MEMORABLE_TIERS) {
    const value = breakdown?.[tier];
    const ids = idsForTier(tier);
    for (const sentence of splitSentences(typeof value === "string" ? value : "")) {
      const score = memorableLineScore(sentence);
      if (score > 0) candidates.push({ text: sentence, score, tier, ids });
    }
  }
  return candidates;
}

/** Case/punctuation-insensitive key for comparing two sentences. */
function normalizeLine(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The distinct source specifics a line carries, in the order the caller supplied
 * them (so "the primary specific" is a deterministic choice, not an accident of
 * sentence order). Matching is case- and punctuation-insensitive on both sides,
 * the same folding every other grounding check applies.
 */
export function specificsPresentIn(text: string, specifics: readonly string[]): string[] {
  const haystack = normalizeLine(text);
  const present: string[] = [];
  for (const specific of specifics) {
    const needle = normalizeLine(specific);
    if (needle.length < 3) continue;
    if (present.includes(specific)) continue;
    if (haystack.includes(needle)) present.push(specific);
  }
  return present;
}

/**
 * PRINCIPLE DENSITY — the share of a line's words that are NOT part of any source
 * specific it carries. 1.0 is a line made entirely of the writer's own statement of
 * the idea; a "Three puffy rolls and one Dutch dollar bought him a fresh start."
 * spends 7 of its 12 words on two identifiers and scores 0.42.
 *
 * This is the ranking key the selector applies BEFORE the aphorism score, which is
 * the whole behavioural change: memorableLineScore rewards length, commas, "you" and
 * decision vocabulary, and is blind to whether the sentence says anything. Ranking on
 * score alone is why every shipped line on the live Franklin book is a token pair.
 */
export function principleDensity(text: string, specifics: readonly string[]): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  let specificWords = 0;
  for (const specific of specificsPresentIn(text, specifics)) {
    specificWords += specific.trim().split(/\s+/).filter(Boolean).length;
  }
  return Math.max(0, (words - specificWords) / words);
}

/** How a selection is scored and constrained. Every field is optional: a caller with
 *  no source packet in hand gets the previous pure-score ordering byte-for-byte. */
export type MemorableSelectionPolicy = Readonly<{
  /** The distinct source specifics this candidate carries, most-primary first. */
  specificsIn?: (candidate: MemorableCandidate) => readonly string[];
  /** Reader-facing passages a memorable line may not simply reproduce — the hook,
   *  the counterintuition and the keyTakeaway (R-281). */
  forbiddenDuplicates?: readonly string[];
}>;

/** At most this many source specifics may appear in a memorable line. See
 *  memorableLineProblems for the reasoning and the live evidence. */
export const MEMORABLE_LINE_MAX_SPECIFICS = 1;

/**
 * THE selection. Both the compile-time gate (SEC15/SEC16, sectionGate.ts) and the
 * assembler that writes `chapter.memorableLines` read this one function, so the
 * sentences the gate validates are exactly the sentences that ship.
 *
 * WHY THIS IS ONE FUNCTION (live evidence, run book-run-910febe1 / QC round
 * qc-29d119c59544a5d991c71c7c9fec04bb): the gate sorted its candidates
 * grounding-first — a deliberate policy (Finding 21) so a retry card could beat a
 * pretty-but-ungroundable sentence — while the assembler sorted by pure aphorism
 * score. Two orderings over one candidate pool select two different top-3 sets. On
 * the Franklin ch03 compiler candidate the gate's set was 3/3 groundable and SEC16
 * passed with zero blockers, while the assembler shipped a set containing an
 * ungroundable line, which ship-time SC11.2 then blocked. Compile validated
 * sentences that never shipped. The ordering is not the defect; having two of them
 * was. `isGrounded` is injected rather than imported so this module keeps no
 * dependency on the gate (sectionGate already imports memorableLineScore from here).
 *
 * OMITTING `isGrounded` reproduces the pure-score ordering byte-for-byte, so a
 * caller with no source packet in hand behaves exactly as before.
 */
export function selectMemorableCandidates(
  candidates: readonly MemorableCandidate[],
  policy: MemorableSelectionPolicy = {},
): MemorableCandidate[] {
  const specificsIn = policy.specificsIn ?? (() => []);
  const forbidden = (policy.forbiddenDuplicates ?? []).map(normalizeLine).filter((value) => value.length > 0);
  const ranked = candidates
    .map((candidate) => {
      const specifics = specificsIn(candidate);
      return {
        candidate,
        specifics,
        grounded: specifics.length <= MEMORABLE_LINE_MAX_SPECIFICS,
        density: principleDensity(candidate.text, specifics),
      };
    })
    .sort((a, b) => {
      if (a.grounded !== b.grounded) return a.grounded ? -1 : 1;
      if (b.density !== a.density) return b.density - a.density;
      return b.candidate.score - a.candidate.score;
    });
  const chosen: MemorableCandidate[] = [];
  const seen = new Set<string>();
  const usedPrimary = new Set<string>();
  // PASS 1 — the constraints the shipped book violated (R-281): never reproduce the
  // hook/counterintuition/keyTakeaway, never spend two lines on one specific.
  for (const entry of ranked) {
    if (chosen.length >= 3) break;
    const key = normalizeLine(entry.candidate.text);
    if (seen.has(key)) continue;
    if (forbidden.some((passage) => passage.includes(key))) continue;
    const primary = entry.specifics[0];
    if (primary !== undefined && usedPrimary.has(primary)) continue;
    seen.add(key);
    if (primary !== undefined) usedPrimary.add(primary);
    chosen.push(entry.candidate);
  }
  // PASS 2 — fill the remaining slots from what is left rather than shipping fewer
  // than three lines. A set that still breaks a constraint is REPORTED (SEC135), not
  // silently shipped: turning a variety constraint into a count failure would send
  // the writer the wrong retry ("seed more candidates") for the wrong defect.
  for (const entry of ranked) {
    if (chosen.length >= 3) break;
    const key = normalizeLine(entry.candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(entry.candidate);
  }
  return chosen;
}

/**
 * The SHIPPED-set checks, shared by the write-time gate (SEC16/SEC135) and by the
 * repair lane, which rewrites the prose these lines were harvested from.
 *
 * R-076, live evidence: `assembleSections` is the only writer of
 * `chapter.memorableLines`, and the candidate-repair lane replaces whole chapters
 * without going near it. The compiler candidate for Franklin ch04 shipped 12/13/13-
 * word lines; the SAME lineage's repair-r7 candidate shipped 16/10/30-word lines, the
 * third being a 176-character plot sentence that memorableLineScore returns 0 for —
 * it could never have been selected. Every per-unit protection in the section gate is
 * a compile-time-only guarantee that any repair round voids unless the repaired
 * chapter is re-derived and re-checked.
 *
 * Returns human-readable problems, empty when the set is compliant.
 */
export function memorableLineProblems(
  lines: readonly { readonly text?: string }[],
  options: Readonly<{
    allSpecifics: readonly string[];
    forbiddenDuplicates: readonly string[];
    /** The chapter's breakdown prose. When supplied, every line must appear in it
     *  verbatim — the same invariant ship-time A11 enforces. */
    proseHaystack: string | null;
  }>,
): string[] {
  const problems: string[] = [];
  const forbidden = options.forbiddenDuplicates.map(normalizeLine).filter((value) => value.length > 0);
  const primaryBy = new Map<string, number>();
  lines.forEach((line, index) => {
    const text = typeof line?.text === "string" ? line.text : "";
    if (text.trim().length === 0) {
      problems.push(`memorableLines[${index}] is empty`);
      return;
    }
    if (options.proseHaystack !== null && !options.proseHaystack.includes(text)) {
      problems.push(`memorableLines[${index}] "${text.slice(0, 70)}" appears nowhere verbatim in the chapter's breakdown prose`);
    }
    const specifics = specificsPresentIn(text, options.allSpecifics);
    if (specifics.length > MEMORABLE_LINE_MAX_SPECIFICS) {
      problems.push(`memorableLines[${index}] "${text.slice(0, 70)}" carries ${specifics.length} source specifics (${specifics.join(", ")}); a memorable line states the principle and carries at most ${MEMORABLE_LINE_MAX_SPECIFICS}`);
    }
    const key = normalizeLine(text);
    if (forbidden.some((passage) => passage.includes(key))) {
      problems.push(`memorableLines[${index}] "${text.slice(0, 70)}" reproduces the hook, counterintuition or keyTakeaway; a pinned line must earn its own place`);
    }
    const primary = specifics[0];
    if (primary === undefined) return;
    const first = primaryBy.get(primary);
    if (first === undefined) primaryBy.set(primary, index);
    else problems.push(`memorableLines[${index}] and memorableLines[${first}] share their primary specific "${primary}"; spend the three lines on three different things`);
  });
  return problems;
}

/**
 * The assembler's entry point. `grounding` is OPTIONAL and absent by default: a
 * caller that supplies neither anchors nor a predicate gets exactly the previous
 * pure-score selection, so every existing call site is byte-identical.
 *
 * Supplying `grounding` is what makes the shipped lines equal the SEC16-validated
 * lines. `anchorIdsForTier` must return the SAME cited-anchor list the gate read
 * (`summaryPack.breakdown.sourceAnchorIds[tier]`), and `isGrounded` must be the
 * SAME check the gate runs; assembleSections wires both from the chapter's own
 * source packet.
 */
export function selectMemorableLinesDeterministic(
  chapter: ChapterV21,
  grounding?: {
    anchorIdsForTier?: (tier: MemorableTier) => unknown;
    policy?: MemorableSelectionPolicy;
  },
): MemorableLine[] {
  const candidates = harvestMemorableCandidates(chapter.breakdown, grounding?.anchorIdsForTier);
  return selectMemorableCandidates(candidates, grounding?.policy ?? {}).map((candidate) => {
    const location = `breakdown.${candidate.tier}`;
    return {
      text: candidate.text,
      location,
      why: memorableLineReason(candidate.text, location, candidate.score),
    };
  });
}

/** Why THIS sentence was selected, in terms of the traits that actually scored it.
 *
 *  Every line previously carried one hardcoded string — "Selected
 *  deterministically: concise, concrete, and reusable as a reader-facing
 *  takeaway." — repeated verbatim for all 12 entries of a four-chapter book. A
 *  justification identical across every choice justifies nothing, and the blind
 *  reader panel caught it as a live AUDIT_FALSE_ATTESTATION: the book-pattern
 *  audit attested literalSubstringGroups:0 while that string sat in the same
 *  input set, so its pass could not be relied on.
 *
 *  The traits below are exactly the ones memorableLineScore rewards, so the
 *  sentence's own reason is derived from why it actually won rather than
 *  asserted. Nothing here is claimed that the score did not measure. */
export function memorableLineReason(text: string, location: string, score: number): string {
  const traits: string[] = [];
  if (/\byou\b/i.test(text)) traits.push("addresses the reader directly");
  if (/\bnot\b.+\bbut\b/i.test(text)) traits.push("names the wrong move against the right one");
  if (/\bwhen\b|\bbefore\b|\bafter\b|\buntil\b/i.test(text)) traits.push("fixes the moment it applies");
  if (/\bchoice\b|\bdecide\b|\bnotice\b|\bpractice\b|\bdefault\b|\bsignal\b|\bcost\b/i.test(text)) {
    traits.push("turns on a decision the reader can act on");
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 8 && words <= 13) traits.push(`sits at ${words} words, quotable without trimming`);
  const tier = location.replace(/^breakdown\./, "");
  const lead = traits.length > 0
    ? traits.join("; ")
    : `stands alone at ${words} words without leaning on its neighbours`;
  return `From the ${tier}: ${lead} (score ${score}).`;
}

export function memorableLineScore(text: string): number {
  const s = text.trim();
  const words = s.split(/\s+/).filter(Boolean).length;
  if (s.length < 25 || s.length > 150) return 0;
  if (words < 6 || words > 16) return 0;
  if (s.includes("—")) return 0;
  if (s.endsWith("?")) return 0;
  if (/:/.test(s)) return 0;
  if ((s.match(/,/g) ?? []).length >= 2 && /\bor\b/i.test(s)) return 0;
  if (/^(it|this|that|they|these|those)\b/i.test(s)) return 0;
  if (BAD_SHAPES.some((pattern) => pattern.test(s))) return 0;
  const lower = s.toLowerCase();
  if (BAD_SNIPPETS.some((bad) => lower.includes(bad.toLowerCase()))) return 0;
  let score = 20;
  if (/\byou\b/i.test(s)) score += 8;
  if (/\bnot\b.+\bbut\b/i.test(s)) score += 8;
  if (/\bwhen\b|\bbefore\b|\bafter\b|\buntil\b/i.test(s)) score += 4;
  // `:` is rejected outright above, so only a comma or semicolon can reach here.
  if (/[,;]/.test(s)) score += 3;
  if (/\bchoice\b|\bdecide\b|\bnotice\b|\bpractice\b|\bdefault\b|\bsignal\b|\bcost\b/i.test(s)) score += 6;
  if (words >= 8 && words <= 13) score += 6;
  return score;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
