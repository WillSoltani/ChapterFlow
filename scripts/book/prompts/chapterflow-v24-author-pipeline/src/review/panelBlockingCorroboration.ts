/**
 * The reader-panel blocking rule — owner decision D2 (A2).
 *
 * A seat's `READER.BLOCKING.<category>` finding is a BLOCKER only when at least
 * two DISTINCT seats raise the SAME category on the SAME chapter (2-of-3
 * corroboration; deterministic matcher = chapter + category). Every other seat
 * blocking finding is kept in the review record as WARN
 * `READER.SINGLE_SEAT.<category>` — same message, same location — so nothing is
 * lost, but it gates nothing. The one exception (D2 = A2): a single seat's
 * `schema_or_app_breaking` still blocks on its own.
 *
 * The in-code precedent is the quiz adjudication (`panelQuizAdjudication.ts`),
 * which already blocks only on a strict blind majority. Quiz verdicts are NOT
 * seat findings and never pass through this function.
 *
 * ONE pure function, called by the semantic panel evaluator's chapter loop over
 * `panel.blockingFindings` and by the S06 replay test over stored reviews. The
 * QC-repair lane inherits it by calling the same evaluator.
 */

import { READER_BLOCKING_CODE_PREFIX, READER_SINGLE_SEAT_CODE_PREFIX } from "./readerPanelIssueCodes.js";

/** Categories that still block on ONE seat — owner decision D2 = A2. */
export const PANEL_SINGLE_SEAT_BLOCKING_CATEGORIES = ["schema_or_app_breaking"] as const;

export type CorroboratedPanelFinding<T> = {
  readonly finding: T;
  readonly code: string;
  readonly severity: "BLOCKER" | "WARN";
};

/**
 * Decide each seat blocking finding under owner decision D2 (A2). Returns, IN
 * INPUT ORDER, one entry per finding, with the finding object untouched.
 *
 * `singleSeatBlocking` exists ONLY so the replay test can cross-check the D2 = A
 * reference table; production callers use the default.
 */
export function corroboratePanelBlockingFindings<T extends { chapter: string | number; seatId: string; category: string }>(
  findings: readonly T[],
  singleSeatBlocking: readonly string[] = PANEL_SINGLE_SEAT_BLOCKING_CATEGORIES,
): CorroboratedPanelFinding<T>[] {
  const seatsByKey = new Map<string, Set<string>>();
  const keyOf = (finding: T): string => JSON.stringify([String(finding.chapter), finding.category]);
  for (const finding of findings) {
    const key = keyOf(finding);
    const seats = seatsByKey.get(key) ?? new Set<string>();
    seats.add(finding.seatId);
    seatsByKey.set(key, seats);
  }
  return findings.map((finding) => {
    const blocks = singleSeatBlocking.includes(finding.category)
      || (seatsByKey.get(keyOf(finding))?.size ?? 0) >= 2;
    return blocks
      ? { finding, code: `${READER_BLOCKING_CODE_PREFIX}${finding.category}`, severity: "BLOCKER" }
      : { finding, code: `${READER_SINGLE_SEAT_CODE_PREFIX}${finding.category}`, severity: "WARN" };
  });
}
