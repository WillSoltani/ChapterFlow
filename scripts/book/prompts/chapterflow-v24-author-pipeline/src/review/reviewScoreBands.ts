/**
 * reviewScoreBands — band anchors for the reviewer 0-100 factor scale (V25 C2).
 *
 * THE DEFECT THIS FIXES. Every reader instrument in this pipeline asks a seat to
 * "score the chapter 0-100 on each factor" and then hands the median composite to
 * a numeric floor (`AUTHOR_CHAPTER_BAR`). Nothing told the seat what a number
 * MEANS, so the panel invented a private scale per seat: on the Franklin canary
 * three blind seats reading the SAME chapter spread by up to 13 composite points.
 * A floor applied to an unanchored scale is not a threshold, it is a coin toss.
 * This module supplies the missing descriptors.
 *
 * WHERE THE NUMBERS COME FROM — AND THE RULE FOR CHANGING THEM. The band names,
 * ranges and counts below are transcribed from the published 140-book
 * content-design screening
 * (`docs/v25/chapterflow-140-evaluation/chapterflow-140-evaluation-report-data.json`).
 * `tests/review-score-bands.test.ts` RECOMPUTES every one of them from that file
 * and rejects any numeric token in the rendered block that it cannot derive.
 * Never hand-edit a number here from memory: a first attempt at this fix shipped
 * "the best book scored 89.7 / no shipped book reached 90" into a judging prompt;
 * the catalogue's real maximum is 90.1 and one book does reach the top band.
 *
 * WHAT IS DELIBERATELY *NOT* CLAIMED. The screening score is a whole-BOOK
 * composite of nine weighted domains under a different rubric; a seat here scores
 * ONE chapter on ten different factors. The two numbers are not the same
 * quantity, and the rendered block says so in as many words. What transfers is
 * the TAXONOMY (what "strong" versus "materially uneven" means as an editorial
 * judgement), not the threshold — which is why this module changes no bar and no
 * weight. It anchors the ruler; it does not move the line.
 */

/** One published interpretation band. `min`/`max` are INCLUSIVE bounds on the
 *  0-100 scale at the one-decimal resolution the catalogue reports. */
export type ReviewScoreBand = {
  /** The band label exactly as the evaluation data publishes it. */
  readonly name: string;
  readonly min: number;
  readonly max: number;
  /** Books of the 140 that landed in this band. */
  readonly count: number;
  /** The per-FACTOR reading of the band, for a seat scoring one chapter. */
  readonly gloss: string;
};

/** Top of the reviewer scale (and of the catalogue's top band). */
export const REVIEW_SCORE_SCALE_MAX = 100;

/** Books in the published content-design screening. */
export const CATALOGUE_BOOK_COUNT = 140;

/** The highest whole-book composite in that screening. */
export const CATALOGUE_TOP_SCORE = 90.1;

/** Weighted domains the screening composite sums over. */
export const CATALOGUE_DOMAIN_COUNT = 9;

/** The published bands, highest first. Contiguous at one-decimal resolution and
 *  covering the whole scale; `bandForCatalogueScore` reproduces the `band` label
 *  the data publishes for all 140 books (pinned by test). */
export const CATALOGUE_SCORE_BANDS: readonly ReviewScoreBand[] = Object.freeze([
  Object.freeze({
    name: "Reference-standard",
    min: 90,
    max: REVIEW_SCORE_SCALE_MAX,
    count: 1,
    gloss: "nothing on this factor a professional editor would ask you to change",
  }),
  Object.freeze({
    name: "Strong",
    min: 80,
    max: 89.9,
    count: 88,
    gloss: "strong on this factor, with identifiable improvements you can name",
  }),
  Object.freeze({
    name: "Valuable but uneven",
    min: 70,
    max: 79.9,
    count: 46,
    gloss: "valuable but materially uneven on this factor; targeted redesign needed",
  }),
  Object.freeze({
    name: "Substantial redesign",
    min: 60,
    max: 69.9,
    count: 3,
    gloss: "this factor needs substantial redesign",
  }),
  Object.freeze({
    name: "Gate failure",
    min: 0,
    max: 59.9,
    count: 2,
    gloss: "not ready as a ChapterFlow learning product on this factor",
  }),
]);

/** The published band label for a catalogue score (highest band whose `min` the
 *  score reaches). Pure. */
export function bandForCatalogueScore(score: number): string {
  for (const band of CATALOGUE_SCORE_BANDS) {
    if (score >= band.min) return band.name;
  }
  return CATALOGUE_SCORE_BANDS[CATALOGUE_SCORE_BANDS.length - 1].name;
}

function bandRangeLabel(band: ReviewScoreBand): string {
  // `max + 0.1` in binary float is 60.000000000000004; round back to the
  // one-decimal resolution the catalogue publishes.
  const openTop = Math.round((band.max + 0.1) * 10) / 10;
  return band.min === 0 ? `below ${openTop}` : `${band.min}-${band.max}`;
}

/** The distribution sentence, e.g. "1 in 90-100 …, 88 in 80-89.9, … and 2 below 60".
 *  Every number in it is a per-band count or a band bound. */
function distributionClause(): string {
  const parts = CATALOGUE_SCORE_BANDS.map(
    // "1 in 90-100" … but "2 below 60" for the open bottom band.
    (band) => `${band.count} ${band.min === 0 ? "" : "in "}${bandRangeLabel(band)}`,
  );
  const last = parts.pop() as string;
  return `${parts.join(", ")} and ${last}`;
}

/**
 * The band block rendered into the reviewer prompts, indented to sit inside the
 * factor list of step 2. Contains NO number that
 * `tests/review-score-bands.test.ts` cannot recompute from the evaluation data.
 *
 * Callers must embed this string VERBATIM — the test asserts `includes(block)`
 * on the instrument the V25 gating panel actually sends to each seat, so a
 * paraphrased copy is a test failure rather than a silent divergence.
 */
export function renderReviewScoreBandBlock(): string {
  const rows = CATALOGUE_SCORE_BANDS.map(
    (band) => `   - ${bandRangeLabel(band)} "${band.name}": ${band.gloss}.`,
  );
  return [
    `   SCORE BANDS — what a number MEANS on each factor. Use this published taxonomy; do not invent a private scale.`,
    ...rows,
    `   WHERE THESE BANDS COME FROM (read before you use them): they are the published ChapterFlow interpretation taxonomy from the ${CATALOGUE_BOOK_COUNT}-book content-design screening. On that screening a score is a whole-BOOK composite of ${CATALOGUE_DOMAIN_COUNT} weighted domains under a DIFFERENT instrument, and the ${CATALOGUE_BOOK_COUNT} books landed ${distributionClause()} (the catalogue's highest score is ${CATALOGUE_TOP_SCORE}). Those counts tell you what the band NAMES are worth in this product; they are NOT a target distribution, and they are NOT directly comparable to your per-factor chapter numbers, which come from this instrument and not that one. Score the chapter in front of you: do not force a bell curve, do not aim at a distribution, and do not move a score to reach or avoid a band.`,
  ].join("\n");
}
