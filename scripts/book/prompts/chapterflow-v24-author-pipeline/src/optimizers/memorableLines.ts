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

export function selectMemorableLinesDeterministic(chapter: ChapterV21): MemorableLine[] {
  const candidates: Array<{ text: string; location: string; score: number; sourceAnchorIds?: string[] }> = [];
  const add = (text: string | undefined, location: string, sourceAnchorIds?: string[]) => {
    for (const sentence of splitSentences(text ?? "")) {
      const score = memorableLineScore(sentence);
      if (score > 0) candidates.push({ text: sentence, location, score, sourceAnchorIds });
    }
  };

  add(chapter.breakdown?.fastRead, "breakdown.fastRead");
  add(chapter.breakdown?.deepRead, "breakdown.deepRead");
  add(chapter.breakdown?.fullRead, "breakdown.fullRead");

  const used = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = c.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 3)
    .map((c) => ({
      text: c.text,
      location: c.location,
      why: memorableLineReason(c.text, c.location, c.score),
      ...(c.sourceAnchorIds && c.sourceAnchorIds.length > 0 ? { sourceAnchorIds: c.sourceAnchorIds.slice(0, 3) } : {}),
    }));
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
