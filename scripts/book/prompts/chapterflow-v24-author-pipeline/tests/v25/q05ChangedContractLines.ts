/**
 * Q05 — the section-contract lines Q05 rewrote on purpose, for EVERY book, as exact
 * [new, old] pairs (sectionTasks.ts universalCore / craftBrief, summary-pack only).
 *
 * Reverse-substituting them (new -> old) in a render from the Q05 tree gives back
 * the pre-Q05 render byte for byte. Two byte-identity proofs use it: the Q05 file's
 * quotation-less cards and Q04's sourceless summary card pin
 * (v4-compiler-application-port.test.ts). A later deliberate edit to one of these
 * lines updates the pair here, and both proofs keep holding against their base.
 */
export const Q05_CHANGED_CONTRACT_LINES: ReadonlyArray<readonly [string, string]> = [
  [
    "fastRead gives the core idea and why it matters;",
    "fastRead gives the immediate move and why it matters now;",
  ],
  [
    "the assembled breakdown reads at Flesch ease >=70. Use shorter common words first (keep every name and date), then split only the longest sentence; a long clause-linked sentence of short words passes. Vary sentence length: no sentence",
    "the assembled breakdown reads at Flesch ease >=70. Vary sentence length: plain verbs, no sentence",
  ],
  [
    "at least two at 14 words or fewer so they count as clean. At most one standalone principle sentence per tier, never a paragraph's last.",
    "at least two at 14 words or fewer so they count as clean.",
  ],
];

export function reverseSubstituteQ05ContractLines(rendered: string): string {
  let out = rendered;
  for (const [next, prev] of Q05_CHANGED_CONTRACT_LINES) out = out.split(next).join(prev);
  return out;
}
