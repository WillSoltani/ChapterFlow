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
  isGrounded?: (candidate: MemorableCandidate) => boolean,
): MemorableCandidate[] {
  const used = new Set<string>();
  const ranked = isGrounded
    ? candidates.map((candidate) => ({ candidate, grounded: isGrounded(candidate) }))
    : candidates.map((candidate) => ({ candidate, grounded: true }));
  return ranked
    .sort((a, b) => (a.grounded === b.grounded ? b.candidate.score - a.candidate.score : a.grounded ? -1 : 1))
    .map((entry) => entry.candidate)
    .filter((candidate) => {
      const key = candidate.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 3);
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
    anchorIdsForTier: (tier: MemorableTier) => unknown;
    isGrounded: (candidate: MemorableCandidate) => boolean;
  },
): MemorableLine[] {
  const candidates = harvestMemorableCandidates(chapter.breakdown, grounding?.anchorIdsForTier);
  return selectMemorableCandidates(candidates, grounding?.isGrounded).map((candidate) => {
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
  if (/[,:;]/.test(s)) score += 3;
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
