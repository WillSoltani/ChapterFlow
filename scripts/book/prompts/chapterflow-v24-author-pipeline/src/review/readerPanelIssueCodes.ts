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
 * True when `code` is `base`, in either of the two spellings it can legitimately
 * carry.
 *
 * Fresh QC re-stamps every canonical-review issue with a `REVIEW.` prefix
 * (`candidateQcEvaluator`), so a consumer reading a QC round sees
 * `REVIEW.READER.PANEL.FACTOR_SCORES` while a consumer reading the review itself
 * sees the bare code. Matching only one spelling silently misclassifies the
 * other — and the repair lane reads the QC round, so the prefixed spelling is
 * the one it actually meets.
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
