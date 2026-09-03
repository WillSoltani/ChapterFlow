/**
 * The reader-panel issue codes that downstream lanes must recognise BY NAME.
 *
 * `READER.PANEL.BELOW_FLOOR` is the only blocker the panel can raise that names
 * no defect — it is a score, not a task. Anything that has to tell "this chapter
 * failed on the number alone" apart from "this chapter has a named defect" must
 * compare against the same literal the evaluator emits, so both sides import it
 * from here instead of re-spelling it.
 *
 * `READER.PANEL.FACTOR_SCORES` is the advisory that carries the per-factor
 * medians. Those scores exist per reader seat but were discarded at the panel
 * boundary; this code is the channel that carries them to the lanes (repair,
 * diagnosis) that need to know WHICH factor is weak.
 *
 * `READER.BLOCKING.<category>` is the panel's named on-page defect. A brief that
 * wants to say "the panel named nothing here" must decide that on the codes, not
 * on a guess, so the prefix test lives here too.
 */

/** Panel median composite below the frozen chapter bar. BLOCKER, names no defect. */
export const READER_PANEL_BELOW_FLOOR_CODE = "READER.PANEL.BELOW_FLOOR" as const;

/** Per-factor panel medians, weakest first. WARN — diagnosis, never a gate. */
export const READER_PANEL_FACTOR_SCORES_CODE = "READER.PANEL.FACTOR_SCORES" as const;

/** Prefix of a panel finding that DOES name an on-page defect. */
export const READER_BLOCKING_CODE_PREFIX = "READER.BLOCKING." as const;

/**
 * The two panel issue codes that are NOT content findings (R-224).
 *
 * `SEMANTIC_PANEL_READER_FAILED` is raised when a seat's model run did not
 * succeed — a provider block, a timeout, an admission collision — and
 * `SEMANTIC_PANEL_READER_UNPARSEABLE` when the seat's own output could not be
 * assembled. Neither says anything about the chapter: the first is the
 * PROVIDER's state and the second is the SEAT's, and the chapter number they
 * carry is only where the panel happened to be standing.
 *
 * The evaluator records both as BLOCKERs and sets the review outcome to ERROR,
 * and ERROR is refused by both repair gates. This list is the third, named
 * guard: a repair brief built from one of these codes would ask a model to
 * rewrite a chapter because the provider was unavailable, and the repair
 * evidence would keep that fabricated content finding forever.
 */
export const READER_PANEL_INFRA_FAILURE_CODE = "SEMANTIC_PANEL_READER_FAILED" as const;
export const READER_PANEL_UNPARSEABLE_CODE = "SEMANTIC_PANEL_READER_UNPARSEABLE" as const;

/** True when `code` is a reader-lane INFRASTRUCTURE failure rather than a
 *  content finding, in either spelling (bare on the review, `REVIEW.`-prefixed
 *  on a QC round — see `isReviewIssueCode`). */
export function isReaderPanelInfraCode(code: string): boolean {
  return isReviewIssueCode(code, READER_PANEL_INFRA_FAILURE_CODE)
    || isReviewIssueCode(code, READER_PANEL_UNPARSEABLE_CODE);
}

/**
 * True when `code` is `base`, in either of the two spellings it can legitimately
 * carry.
 *
 * Fresh QC re-stamps every canonical-review issue with a `REVIEW.` prefix
 * (`candidateQcEvaluator`), so a consumer reading a QC round sees
 * `REVIEW.READER.PANEL.FACTOR_SCORES` while a consumer reading the review itself
 * sees the bare code. Matching only one spelling silently misclassifies the
 * other, and BOTH are live: the QC repair lane reads a committed QC round and
 * meets the prefixed spelling, while the review-FAIL repair lane
 * (`runFromReviewFail`) reads the canonical review itself and meets the bare one.
 */
export function isReviewIssueCode(code: string, base: string): boolean {
  return code === base || code === `REVIEW.${base}`;
}

/** True when `code` is a panel finding that named an on-page defect, in either
 *  spelling (`READER.BLOCKING.*` on the review, `REVIEW.READER.BLOCKING.*` on a
 *  QC round). */
export function isReaderBlockingCode(code: string): boolean {
  return code.startsWith(READER_BLOCKING_CODE_PREFIX) || code.startsWith(`REVIEW.${READER_BLOCKING_CODE_PREFIX}`);
}
