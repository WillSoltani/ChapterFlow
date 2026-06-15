/**
 * Deterministic guard against FABRICATED model-reviewer findings.
 *
 * A model-judged QC role (sweep/bar/confirm) can hallucinate a defect the
 * deterministic gates can't see. The-daily-stoic round r20260615053335 shipped a
 * sweep finding claiming `implementationPlan.challenge` was duplicated verbatim
 * into `implementationPlan.twentyFourHourChallenge` across all 12 chapters — but
 * there is NO `challenge` field in the schema (0/12 chapters have one). It was a
 * pure invention that nonetheless set sweep=FAIL on every chapter and inflated the
 * repair list by ~13 items.
 *
 * This catches that class deterministically: a finding that cites a dotted
 * `<container>.<field>` path where the container is a real ChapterV21 container
 * but the field does NOT exist is fabricated. Conservative by design — it only
 * inspects KNOWN containers, so a finding that doesn't name a dotted field path
 * (or names an unknown container) is never rejected.
 */

import type { SubmissionFinding } from "./schemas.js";

/** Real fields per ChapterV21 container. A `<container>.<field>` reference whose
 *  field is absent here (for a listed container) is a fabricated unit. */
const CONTAINER_FIELDS: Record<string, ReadonlySet<string>> = {
  implementationPlan: new Set(["coreSkill", "twentyFourHourChallenge", "weeklyPractice", "ifThenPlans", "title"]),
  breakdown: new Set(["fastRead", "deepRead", "fullRead"]),
  planSpec: new Set(["domain", "audience", "stakes", "format", "requiredBeat", "venue", "exemplar"]),
  quiz: new Set(["questions", "prompt", "choices", "explanation", "correctIndex", "bloomsLevel"]),
  example: new Set(["scenario", "whatToDo", "whyItMatters", "title", "planSpec", "tags"]),
  examples: new Set(["scenario", "whatToDo", "whyItMatters", "title", "planSpec", "tags"]),
  reviewCard: new Set(["front", "back"]),
  reviewCards: new Set(["front", "back"]),
  memorableLine: new Set(["text"]),
  memorableLines: new Set(["text"]),
};

const PATH_RE = /\b([a-zA-Z]+)\.([a-zA-Z][a-zA-Z0-9]*)\b/g;

/** The first `container.field` reference in the finding that names a field which
 *  does NOT exist on a known container, or null when the finding is clean. */
export function citesNonexistentField(
  finding: Pick<SubmissionFinding, "unitId" | "quote" | "problem" | "expectedFix">,
): string | null {
  const text = [finding.unitId, finding.quote, finding.problem, finding.expectedFix].filter(Boolean).join("  ");
  PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_RE.exec(text)) !== null) {
    const allowed = CONTAINER_FIELDS[m[1]];
    if (allowed && !allowed.has(m[2])) return `${m[1]}.${m[2]}`;
  }
  return null;
}

/** True when EVERY finding is fabricated (cites a non-existent field) — i.e. the
 *  submission provides no valid evidence. Empty list → false (no claim made). */
export function allFindingsFabricated(findings: ReadonlyArray<Pick<SubmissionFinding, "unitId" | "quote" | "problem" | "expectedFix">>): boolean {
  return findings.length > 0 && findings.every((f) => citesNonexistentField(f) !== null);
}
