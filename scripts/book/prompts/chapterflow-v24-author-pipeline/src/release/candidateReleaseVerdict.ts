/**
 * candidateReleaseVerdict — the evidence a released candidate pair carries
 * about its OWN verdict (R-254, and the release-side half of R-229).
 *
 * THE DEFECT. `productionManifest.payload.candidateQcEvidence` recorded exactly
 * `{ source, reviewId, qcRoundId, perChapterAttestation }` — two ids and a
 * disclaimer. Neither a verifier nor a human could tell from the released pair
 * that the named round even PASSed, and the round/review JSON it names lives
 * only under the v25 root, which is never committed, which cleanup does not
 * touch and which publish never preserves. The shipped Franklin sidecar was
 * verified verbatim in that shape. Meanwhile the round itself carried
 * `Counter({'WARN': 235})` — including a 75.4 panel composite — and nothing
 * downstream parsed any of it (R-229).
 *
 * WHAT THIS ADDS. A `verdict` block, hashed into the contentId like every other
 * payload field, stating:
 *   - the QC round's OUTCOME and its issue counts by severity;
 *   - the canonical review's issue counts by severity;
 *   - the per-chapter reader-panel composites, parsed out of the review's own
 *     `REVIEW.READER.PANEL.FACTOR_SCORES` WARNs — the numbers that were free
 *     text nothing read;
 *   - the whole-book catalog rubric's composite, medians, gate, churn and the
 *     bar the gate enforced, as RECORDED by the run that enforced it (R-080).
 *
 * PARSED, NOT RE-DERIVED. Every number here comes from an artifact the release
 * already holds and the promotion service already verified; nothing is
 * recomputed and nothing is invented. A missing rubric record yields NO rubric
 * block rather than a fabricated one — a release of a candidate scored before
 * the rubric stage existed must say "no rubric", never "rubric fine".
 */

import { CATALOG_RUBRIC_FACTOR_FLOOR, aggregateCatalogRubric } from "../review/catalogRubric.js";
import type { CatalogRubricRecordV1 } from "../review/catalogRubricStore.js";
import type { QcRoundResult } from "../qc/qcTypes.js";
import { READER_PANEL_FACTOR_SCORES_CODE } from "../review/readerPanelIssueCodes.js";
import type { CanonicalReviewResult, ReviewIssue } from "../review/reviewTypes.js";
import type { QcIssue } from "../qc/qcTypes.js";

/** Issue counts by severity. Always all three keys, always a number, so a
 *  consumer never has to distinguish "zero" from "not recorded". */
export type ReleaseIssueCounts = {
  readonly BLOCKER: number;
  readonly WARN: number;
  readonly INFO: number;
};

export type ReleasePanelChapterComposite = {
  readonly chapterNumber: number;
  readonly composite: number;
};

export type ReleaseRubricEvidence = {
  readonly instrumentVersion: string;
  readonly composite: number;
  readonly tier: string;
  readonly gate: "PASS" | "FAIL" | "SPLIT";
  readonly churn: "LOW" | "MED" | "HIGH";
  /**
   * The promotion bar the BOOK RUN's gate enforced against this panel, read out
   * of the durable record — `null` when the record predates the field and no
   * bar was recorded.
   *
   * It is never re-resolved here. The release runs later and in its own
   * environment, so resolving `CHAPTERFLOW_RUBRIC_BAR` (or falling back to the
   * compiled default) recorded `bar: 80` for a book that was actually gated at
   * `--rubric-bar 90`: a number that looked like evidence and was not. An
   * unknown bar is stated as unknown.
   */
  readonly bar: number | null;
  readonly factorFloor: number;
  readonly highQuality: boolean;
  /** Factor medians, factor-keyed. */
  readonly factorMedians: Readonly<Record<string, number>>;
  readonly sampledChapterNumbers: readonly number[];
  readonly totalChapters: number;
  readonly readerCount: number;
};

export type CandidateReleaseVerdict = {
  readonly qcOutcome: QcRoundResult["outcome"];
  readonly qcIssueCounts: ReleaseIssueCounts;
  readonly reviewOutcome: CanonicalReviewResult["outcome"];
  readonly reviewIssueCounts: ReleaseIssueCounts;
  /** Ascending by chapter number. Empty when the review carried no panel
   *  diagnosis (a legacy review, or one produced by the baseline evaluator). */
  readonly panelChapterComposites: readonly ReleasePanelChapterComposite[];
  /** Absent when the candidate has no durable catalog-rubric record. */
  readonly rubric?: ReleaseRubricEvidence;
};

/**
 * The rubric half of the verdict block, assembled from the DURABLE RECORD alone.
 *
 * The aggregate is recomputed from the stored reader blocks (so it can never
 * drift from them) and the bar is REPLAYED from the record (so it is the bar the
 * gate ran against, or `null`). Nothing here consults the environment: this
 * function's whole job is to state what was measured and decided elsewhere.
 */
export function buildReleaseRubricEvidence(record: CatalogRubricRecordV1): ReleaseRubricEvidence {
  const aggregate = aggregateCatalogRubric(record.readers);
  return Object.freeze({
    instrumentVersion: record.instrumentVersion,
    composite: aggregate.composite,
    tier: aggregate.tier,
    gate: aggregate.gate,
    churn: aggregate.churn,
    bar: record.gateBar ?? null,
    factorFloor: CATALOG_RUBRIC_FACTOR_FLOOR,
    highQuality: aggregate.highQuality,
    factorMedians: Object.freeze({ ...aggregate.factorMedians }),
    sampledChapterNumbers: Object.freeze([...record.sampledChapterNumbers]),
    totalChapters: record.totalChapters,
    readerCount: aggregate.readerCount,
  });
}

export function countIssuesBySeverity(
  issues: readonly (Readonly<{ severity: string }>)[],
): ReleaseIssueCounts {
  let blocker = 0;
  let warn = 0;
  let info = 0;
  for (const issue of issues) {
    if (issue.severity === "BLOCKER") blocker += 1;
    else if (issue.severity === "WARN") warn += 1;
    else if (issue.severity === "INFO") info += 1;
  }
  return { BLOCKER: blocker, WARN: warn, INFO: info };
}

/** `ch07` → 7. Any other location shape yields null; the panel emits exactly
 *  this shape (`semanticPanelReviewEvaluator` pads to two digits). */
export function chapterNumberFromLocation(location: string | undefined): number | null {
  if (typeof location !== "string") return null;
  const match = /^ch(\d{2,})$/.exec(location);
  if (match === null) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

/**
 * The per-chapter panel composites the review recorded as free text.
 *
 * The message shape is the panel's own, emitted unconditionally for every
 * chapter it read:
 *
 *     reader-panel median composite 75.4 (chapter bar 70); factor medians …
 *
 * Parsed rather than recomputed because the review is the only surviving record
 * of what the panel said — the seat reviews are gone by release time. A message
 * that does not match is SKIPPED, never guessed at: a wrong composite in the
 * sidecar would be worse than an absent one. Ascending by chapter, deduplicated
 * on chapter number (first wins) so a malformed review cannot inflate the list.
 */
export function parsePanelChapterComposites(
  issues: readonly ReviewIssue[],
): readonly ReleasePanelChapterComposite[] {
  const byChapter = new Map<number, number>();
  for (const issue of issues) {
    if (issue.code !== READER_PANEL_FACTOR_SCORES_CODE) continue;
    const chapterNumber = chapterNumberFromLocation(issue.location);
    if (chapterNumber === null || byChapter.has(chapterNumber)) continue;
    const match = /reader-panel median composite (\d+(?:\.\d+)?)\b/.exec(issue.message);
    if (match === null) continue;
    const composite = Number(match[1]);
    if (!Number.isFinite(composite)) continue;
    byChapter.set(chapterNumber, composite);
  }
  return Object.freeze([...byChapter.entries()]
    .sort(([left], [right]) => left - right)
    .map(([chapterNumber, composite]) => Object.freeze({ chapterNumber, composite })));
}

/** Assemble the verdict block from artifacts the release already holds. Pure. */
export function buildCandidateReleaseVerdict(input: Readonly<{
  review: Readonly<{ outcome: CanonicalReviewResult["outcome"]; issues: readonly ReviewIssue[] }>;
  qcRound: Readonly<{ outcome: QcRoundResult["outcome"]; issues: readonly QcIssue[] }>;
  rubric?: ReleaseRubricEvidence;
}>): CandidateReleaseVerdict {
  return Object.freeze({
    qcOutcome: input.qcRound.outcome,
    qcIssueCounts: countIssuesBySeverity(input.qcRound.issues),
    reviewOutcome: input.review.outcome,
    reviewIssueCounts: countIssuesBySeverity(input.review.issues),
    panelChapterComposites: parsePanelChapterComposites(input.review.issues),
    ...(input.rubric === undefined ? {} : { rubric: input.rubric }),
  });
}
