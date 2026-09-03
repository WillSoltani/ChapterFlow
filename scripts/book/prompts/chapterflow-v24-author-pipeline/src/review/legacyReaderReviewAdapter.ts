/**
 * legacyReaderReviewAdapter — REPLAY-ONLY bridge from a persisted legacy
 * `ChapterReviewV1` (the `reader-rubric-v3-phase1` instrument) onto the shape of
 * the new `ReaderExperienceReviewV1` (IMP-20 §E, WP-B1).
 *
 * Its single hard invariant (the version wedge): an adapted legacy record can
 * NEVER satisfy the new freshness predicate `readerReviewIsFresh`, because it
 * stamps the LEGACY `rubricVersion` ("reader-rubric-v3-phase1") and the
 * `"legacy-no-schema"` sentinel — neither of which equals the new
 * `READER_EXPERIENCE_RUBRIC_VERSION`. Old ship84 evidence therefore goes stale
 * and cannot be replayed as a fresh gate input. This module does NOT modify the
 * frozen legacy `readerReview.ts`; it only reads a `ChapterReviewV1` and maps it.
 *
 * Mapping decisions (documented — no inference):
 *   - `ship84` → `recommendation`: ship84===true → SHIP; a no-ship carrying a
 *     legacy `mustFix` complaint → BLOCK; a no-ship with no mustFix (the "ship
 *     bit artifact" case, e.g. a ≥bar zero-mustFix chapter the model declined to
 *     ship) → REVISE. A low composite alone is a craft/quality REVISE, never a
 *     hard BLOCK.
 *   - Legacy complaints DO NOT carry which reserved category triggered mustFix
 *     (only unit/problem/mustFix), and the new BLOCKING categories deliberately
 *     dropped the external source-truth ones (E-01). Since the concrete blocking
 *     category cannot be recovered without INFERENCE — which IMP-20 forbids —
 *     legacy complaints are carried into `advisoryFindings` as `other_craft`
 *     (annotated with `[legacy mustFix]` where applicable) and the severity of a
 *     legacy mustFix is captured by the `recommendation`, not by fabricating an
 *     on-page blocking category. `blockingFindings`/`escalationSignals` stay
 *     empty: a replay record is never fresh, so it can never be a live gate input.
 */

import type { ChapterReviewV1 } from "../artifacts/artifactTypes.js";
import { READER_RUBRIC_VERSION } from "./readerReview.js";
import type { ReaderExperienceReviewV1 } from "../contracts/readerExperienceReview.js";

/** The `schemaSha256` sentinel a legacy record carries — it never had an
 *  execution-enforced output schema, so it can never match a real schema sha. */
export const LEGACY_NO_SCHEMA = "legacy-no-schema" as const;

/** The `readerDocumentSha256` fallback for a pre-E2 legacy record that recorded
 *  no `docHash`. A record MISSING a doc hash was never reusable anyway. */
export const LEGACY_NO_DOC_HASH = "legacy-no-doc-hash" as const;

/** The legacy rubric version the adapter stamps — deliberately NOT the new
 *  `READER_EXPERIENCE_RUBRIC_VERSION`, so freshness fails on the version wedge.
 *  Re-exported from the frozen legacy module so the two never drift. */
export { READER_RUBRIC_VERSION as LEGACY_READER_RUBRIC_VERSION } from "./readerReview.js";

/** Mechanism sentinel for a replayed legacy derivation: the legacy instrument
 *  had no mechanism field, and a blank string would read as "the reader looked
 *  and found none". */
export const LEGACY_NO_MECHANISM = "legacy instrument recorded no mechanism" as const;

/** ship84 + mustFix + composite → advisory recommendation (see module header). */
function deriveRecommendation(old: ChapterReviewV1): "SHIP" | "REVISE" | "BLOCK" {
  if (old.ship84 === true) return "SHIP";
  const hasMustFix = (old.complaints ?? []).some((c) => c.mustFix === true);
  return hasMustFix ? "BLOCK" : "REVISE";
}

/** Adapt a persisted legacy `ChapterReviewV1` onto the new
 *  `ReaderExperienceReviewV1` shape for REPLAY only. The result is a
 *  schema-valid record that can NEVER be fresh (rubricVersion + schemaSha256
 *  wedge). */
export function adaptLegacyReaderReview(old: ChapterReviewV1): ReaderExperienceReviewV1 {
  const answers = (old.keyCheck?.derived ?? []).filter(
    (a): a is "a" | "b" | "c" => a === "a" || a === "b" || a === "c",
  );
  return {
    schema: "reader-experience-review-v1",
    reviewerRole: "reader-experience",
    chapterContentSha256: old.contentHash,
    readerDocumentSha256: old.docHash ?? LEGACY_NO_DOC_HASH,
    rubricVersion: READER_RUBRIC_VERSION,
    schemaSha256: LEGACY_NO_SCHEMA,
    scores: { ...old.scores },
    quizDerivation: {
      answers,
      // The legacy instrument recorded DERIVED ANSWERS ONLY: it had no
      // mechanism, confidence or ambiguity field. The new contract requires the
      // four arrays to be positional with each other (R-133), so the missing
      // three are padded to the answer count with values that assert nothing the
      // legacy record did not say: an explicit "not recorded" mechanism, the
      // WEAKEST confidence (a replayed record can never claim certainty it did
      // not capture), and an empty ambiguity.
      mechanisms: answers.map(() => LEGACY_NO_MECHANISM),
      confidence: answers.map(() => "low" as const),
      ambiguities: answers.map(() => ""),
      tells: [...(old.tells ?? [])],
    },
    recommendation: deriveRecommendation(old),
    blockingFindings: [],
    escalationSignals: [],
    advisoryFindings: (old.complaints ?? []).map((c) => ({
      category: "other_craft" as const,
      unit: c.unit,
      problem: c.mustFix ? `${c.problem} [legacy mustFix]` : c.problem,
      evidenceSpans: [],
    })),
    strongestEvidence: (old.quotes ?? []).map((q) => q.quote),
    weakestEvidence: [],
    oneParagraphVerdict: old.oneParagraphVerdict ?? "",
  };
}
