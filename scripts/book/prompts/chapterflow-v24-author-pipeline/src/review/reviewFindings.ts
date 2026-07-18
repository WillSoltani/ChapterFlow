/**
 * reviewFindings (IMP-08, plan instructions 8-9) — normalize reviewer
 * complaints into frozen `RepairFindingV1` objects with VERIFIED evidence.
 *
 * Reviewer prose is untrusted. This adapter trusts only what it can verify:
 *   - the review's quotes must have byte-verified (an invalid review emits
 *     ZERO findings — same trust rule adjudication already enforces);
 *   - any text a complaint itself quotes ("…" runs) must be a verified
 *     substring of the document the reviewer actually saw — a complaint
 *     citing absent text is REJECTED, never silently kept;
 *   - the finding's repair scope comes from the DETERMINISTIC complaint-scope
 *     classifier (authorRepair.deriveComplaintScope) — a reviewer cannot name
 *     its own scope, an unclassifiable/vetoed complaint emits no finding;
 *   - the constructed object passes the frozen validator, so a control-plane
 *     smuggle (a complaint asking to change models/gates/files) is inert
 *     prose inside `evidenceQuotes`, never a field and never a scope.
 *
 * Findings feed IMP-07's classifyRepairRoute/patch lane unchanged. Rejections
 * are returned (not thrown) so callers can log them — a rejected finding is
 * information, not an error.
 */

import type { ChapterReviewComplaint } from "../artifacts/artifactTypes.js";
import { type RepairFindingV1, validateRepairFinding } from "../contracts/repairContracts.js";
import { deriveComplaintScope } from "../orchestrator/authorRepair.js";
import { quoteVerified } from "./readerReview.js";

export type ReviewFindingRejection = { complaint: ChapterReviewComplaint; reason: string };

export type ReviewFindingsResult = {
  findings: RepairFindingV1[];
  rejected: ReviewFindingRejection[];
};

/** The same content-lineage prohibitions IMP-07's complaint bridge pins. */
const FINDING_PROHIBITED_CHANGES: readonly string[] = [
  "origin", "form", "claimStrength", "detailSufficiency", "framingRequired",
];

/** Extract the "…"-quoted runs (≥12 chars) a complaint cites — the substrings
 *  instruction 9 requires to exist in the reviewed document. */
export function complaintQuotedRuns(problem: string): string[] {
  const out: string[] = [];
  for (const m of problem.matchAll(/["“]([^"”]{12,})["”]/g)) out.push(m[1]);
  return out;
}

/** Normalize one adjudicated review's complaints into frozen findings.
 *  `docText` MUST be the exact document the reviewer scored (the phase-1 doc);
 *  quote checks run against it. */
export function reviewComplaintsToFindings(opts: {
  complaints: readonly ChapterReviewComplaint[];
  /** adjudicateReview's quote byte-verification verdict for the whole review. */
  reviewValid: boolean;
  reviewerSessionId: string;
  docText: string;
}): ReviewFindingsResult {
  const rejected: ReviewFindingRejection[] = [];
  const findings: RepairFindingV1[] = [];
  if (!opts.reviewValid) {
    for (const complaint of opts.complaints) {
      rejected.push({ complaint, reason: "review failed quote byte-verification — its complaints are untrusted" });
    }
    return { findings, rejected };
  }
  const sessionTag = (opts.reviewerSessionId || "anon").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48);
  opts.complaints.forEach((complaint, i) => {
    const combined = `${complaint.unit}: ${complaint.problem}`;
    // Instruction 9: every substring the complaint itself quotes must exist in
    // the document the reviewer saw. Absent text = rejected finding.
    for (const run of complaintQuotedRuns(complaint.problem)) {
      if (!quoteVerified(opts.docText, run)) {
        rejected.push({ complaint, reason: `cites text absent from the reviewed document: "${run.slice(0, 80)}"` });
        return;
      }
    }
    const scope = deriveComplaintScope(combined);
    if (scope === "VETO" || scope === null) {
      rejected.push({ complaint, reason: scope === "VETO" ? "complaint class is vetoed for scoped repair (prose/quality/count)" : "complaint is unclassifiable to a repair scope" });
      return;
    }
    const finding: RepairFindingV1 = {
      schema: "repair-finding-v1",
      findingId: `review.${sessionTag}#${i}`,
      category: complaint.mustFix ? "review.must-fix" : "review.advisory",
      severity: complaint.mustFix ? "must_fix" : "advisory",
      unitIds: [],
      evidenceQuotes: [combined.slice(0, 500)],
      violatedInvariantIds: [],
      permittedRepairScope: [scope],
      prohibitedChanges: [...FINDING_PROHIBITED_CHANGES],
      sourcePlanDependencies: [],
      recommendedRoute: "surgical",
    };
    const errors = validateRepairFinding(finding);
    if (errors.length > 0) {
      rejected.push({ complaint, reason: `frozen finding validation failed: ${errors.join("; ")}` });
      return;
    }
    findings.push(finding);
  });
  return { findings, rejected };
}
