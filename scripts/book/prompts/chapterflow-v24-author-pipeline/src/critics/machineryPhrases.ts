/**
 * Shared machinery-vocabulary data (CF-I-1, 2026-07-09).
 *
 * The v24 brief RESERVES per chapter an example-entry beat and an outcome beat
 * (see compiler/briefRotation.ts EXAMPLE_ENTRY_POINTS / EXAMPLE_OUTCOMES and their
 * *_INSTRUCTION strings). Those instruction strings are internal DEALING vocabulary
 * — the writer is meant to render the BEAT, not the label. On the fresh `multipliers`
 * validation run the labels leaked into reader prose verbatim: "return point",
 * "early signal", "the late catch", "return moment" recur across chapters as house
 * phrasing (verification report §7.3.3 — "The contract's own beat names are this
 * book's nascent 'Agreement nods; commitment signs.'").
 *
 * This module is the SINGLE SOURCE OF TRUTH for the leakable surface forms so the
 * DETECTOR (C33, critics/beatVocabularyEcho.ts) and the future CARD/INSTRUCTION text
 * (CF-I-2, which rewrites briefRotation's instruction strings) cannot drift apart.
 * It is DATA only — it does not import or change briefRotation, and reading it has no
 * effect on the deal. CF-I-2 consumes this list when it de-mints the instructions.
 *
 * PHRASE FAMILIES, not raw strings. Each family is one beat with several surface
 * spellings ("caught late" / "late catch" are one averted-late beat); a family counts
 * AT MOST ONCE per chapter so a chapter that renders the same beat two ways is not
 * double-charged. The families are deliberately the DISTINCTIVE, corpus-rare beat
 * names — the phrase set was pruned against the v24 gold corpus (start-with-why, a
 * v24 machine-brief book that carries the SAME dealt vocabulary): broader tokens like
 * "the return"/"the late" fire on a majority of gold chapters and were dropped (they
 * would be the SC9-reversal over-broad trap). The four families below keep the signal
 * separable — see the pins in tests/beat-vocabulary-echo.test.ts.
 *
 * SOURCE of each family (briefRotation.ts instruction string it echoes):
 *   return-point   ← EXAMPLE_OUTCOMES "still-open": "the return point is set but not yet met";
 *                    ARCHITECTURE "failure-autopsy": "the 'proof must come back / return point' reversal drill"
 *   return-moment  ← EXAMPLE_ENTRY_POINTS "at-the-return-moment": "open AT the check-in/return moment itself"
 *   early-signal   ← EXAMPLE_ENTRY_POINTS "before-anyone-notices": "open on the early signal nobody has flagged yet"
 *   late-catch     ← EXAMPLE_OUTCOMES "averted-late": "headed for a miss, caught late — barely"
 *
 * NOTE (CF-I-2, 2026-07-09): the four SOURCE instruction strings quoted above were
 * DE-MINTED in briefRotation.ts — they now describe each beat's shape in stage-
 * direction voice that carries none of these surface forms, and the rhetoric-plan
 * deal↔gate guard pins that no rotation instruction may reintroduce one. The surface
 * list still reflects what leaked into the multipliers reader prose (the DETECTOR's
 * job) — this module stays the single source of truth for both the detector and the
 * de-minting guard.
 *
 * CF-I RE-MINT FOLLOW-UP (2026-07-09): the CF-I-2 de-mint wording itself minted new
 * quotables — "reckoning" appeared in TWO instruction strings ("the reckoning moment"
 * / "the reckoning is set but not yet met"), "first sign" replaced "early signal" in
 * before-anyone-notices, and the stem "set but not yet met" survived verbatim. None
 * was on this watchlist, so the deal↔gate pin and C33 were blind to them and a regen
 * re-minted "the film still carries the reckoning" into multipliers ch02 reader prose.
 * The three families below close that blindness; the instruction strings were
 * re-worded again to carry none of them. MEASURED (2026-07-09) over the three corpora
 * — gold start-with-why state/chapters (14 ch), book-packages/high-output-management
 * .v21.json (16 ch), current multipliers state/chapters (9 ch), reader-facing text
 * per C33's readerFacingText scope:
 *   "reckoning"            gold 0 / HOM 0 / multipliers 1 (ch02 — the re-mint leak
 *                          itself, i.e. the intended detection, not a false positive).
 *   "first sign" (bare)    gold 0 / HOM 0 / multipliers 1 (ch06 "at the first sign of
 *                          strain" — LEGITIMATE idiom predating the de-mint wording,
 *                          so the bare form is a false positive; SCOPED to the
 *                          instructed collocation "first sign nobody", which measures
 *                          0/0/0 while still catching the de-mint string verbatim).
 *   "set but not yet met"  gold 0 / HOM 0 / multipliers 0 in reader-facing text (the
 *                          only raw-file hits are internal planSpec.requiredBeat
 *                          fields, which are stripped at promote and outside C33's
 *                          reader surface).
 * With these additions the C33 gold pins are UNCHANGED (re-measured: per-chapter 3 —
 * ch2/9/10; book-level 4 families).
 */

/** One beat family: a stable key + the reader-facing surface spellings that render
 *  it. Matching is case-insensitive, word-boundary anchored, substring-free (each
 *  surface is matched with \b…\b at use sites). */
export type MachineryBeatFamily = {
  /** stable identifier for the beat (used in advisory messages + book-level keys). */
  key: string;
  /** the dealt instruction wording this beat comes from (documentation, not matched). */
  source: string;
  /** the reader-facing surface forms; a family fires if ANY surface is present. */
  surfaces: string[];
};

export const MACHINERY_BEAT_FAMILIES: MachineryBeatFamily[] = [
  {
    key: "return-point",
    source: 'EXAMPLE_OUTCOMES "still-open" / ARCHITECTURE "failure-autopsy"',
    surfaces: ["return point"],
  },
  {
    key: "return-moment",
    source: 'EXAMPLE_ENTRY_POINTS "at-the-return-moment"',
    surfaces: ["return moment"],
  },
  {
    key: "early-signal",
    source: 'EXAMPLE_ENTRY_POINTS "before-anyone-notices"',
    surfaces: ["early signal"],
  },
  {
    key: "late-catch",
    source: 'EXAMPLE_OUTCOMES "averted-late"',
    surfaces: ["late catch", "caught late"],
  },
  // ── CF-I re-mint follow-up families (2026-07-09) — see the header NOTE for the
  // full corpus measurements behind each surface choice. ──
  {
    key: "reckoning",
    source: 'CF-I-2 de-mint wording of ENTRY_INSTRUCTION "at-the-return-moment" + OUTCOME_INSTRUCTION "still-open" (both since re-worded)',
    surfaces: ["reckoning"],
  },
  {
    key: "first-sign",
    // SCOPED: bare "first sign" fires on legitimate idiom (multipliers ch06 "at the
    // first sign of strain"); the instructed collocation is the leakable quotable.
    source: 'CF-I-2 de-mint wording of ENTRY_INSTRUCTION "before-anyone-notices" (since re-worded)',
    surfaces: ["first sign nobody"],
  },
  {
    key: "set-but-not-yet-met",
    source: 'CF-I-2 de-mint stem in OUTCOME_INSTRUCTION "still-open" (since re-worded)',
    surfaces: ["set but not yet met"],
  },
];

/** All distinct surface strings across families (for callers that want a flat list —
 *  e.g. CF-I-2 building a "do not narrate these beat names" instruction). */
export const MACHINERY_BEAT_SURFACES: string[] = MACHINERY_BEAT_FAMILIES.flatMap((f) => f.surfaces);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Precompiled per-family matcher (word-boundary, case-insensitive). Pure. */
const FAMILY_MATCHERS: Array<{ key: string; re: RegExp }> = MACHINERY_BEAT_FAMILIES.map((f) => ({
  key: f.key,
  re: new RegExp(`\\b(?:${f.surfaces.map(escapeRegex).join("|")})\\b`, "i"),
}));

/** The DISTINCT beat-family keys present in a block of reader-facing text. A family
 *  with two surfaces present still returns once. Pure, deterministic, order-stable. */
export function beatFamiliesInText(text: string): string[] {
  if (typeof text !== "string" || !text) return [];
  const hits: string[] = [];
  for (const { key, re } of FAMILY_MATCHERS) {
    if (re.test(text)) hits.push(key);
  }
  return hits;
}
