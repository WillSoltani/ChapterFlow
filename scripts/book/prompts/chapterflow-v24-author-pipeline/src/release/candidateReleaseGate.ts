/**
 * The release-time verdict on the candidate's OWN book gate (R-228).
 *
 * `createCliV25Composition` already ran the full book gate against the candidate
 * — `runBookGateFromCandidate` — and read exactly one thing out of it: the
 * pattern-audit report, which it packed into the composition for later use. The
 * verdict itself (`passed`, its blockers, its majors) had no reader anywhere: the
 * candidate branch of `runPromoteBook` went straight on to `release.release()`.
 * So the gate ran, found whatever it found, and the release shipped regardless.
 *
 * This module turns that report into a decision plus the lines an operator needs
 * to see BEFORE the pointer moves. It is pure — no I/O, no ambient state — so the
 * refusal is unit-testable and the call site is one `if`.
 *
 * BLOCKERS refuse. Majors and minors are PRINTED, not enforced here: the book
 * gate's own contract is `passed = blockers.length === 0`, and this module does
 * not invent a second, stricter bar the rest of the pipeline does not share.
 */
import type { BookGateFinding, BookGateReport } from "../critics/bookGate.js";

export type CandidateReleaseGateVerdict = Readonly<{
  /** false ⇒ the release must refuse. Mirrors BookGateReport.passed. */
  passed: boolean;
  blockers: number;
  majors: number;
  minors: number;
  /** The findings that caused the refusal (empty when it passed). */
  blockerFindings: readonly BookGateFinding[];
  /** Operator-facing report lines, printed before the release call either way. */
  lines: readonly string[];
  /** One-line refusal, ready for console.error. Empty when it passed. */
  refusal: string;
}>;

const MAX_LISTED = 12;

function countBySeverity(findings: readonly BookGateFinding[], severity: BookGateFinding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

function describe(finding: BookGateFinding): string {
  const where = finding.chapters && finding.chapters.length > 0 ? ` (ch${finding.chapters.join(",")})` : "";
  return `${finding.severity.toUpperCase()} ${finding.catalogId}${where}: ${finding.message}`;
}

export function evaluateCandidateReleaseGate(gate: BookGateReport): CandidateReleaseGateVerdict {
  const blockerFindings = gate.findings.filter((finding) => finding.severity === "blocker");
  const majors = countBySeverity(gate.findings, "major");
  const minors = countBySeverity(gate.findings, "minor");
  const audit = gate.stats.patternAudit;
  const auditCodes = audit.findings.map((finding) => `${finding.code}(${finding.severity})`);

  const lines: string[] = [
    `candidate book gate — ${gate.bookId} (${gate.chapterCount} chapter(s)): ${gate.passed ? "PASS" : "BLOCKED"} ` +
      `— ${blockerFindings.length} blocker / ${majors} major / ${minors} minor`,
    `  pattern audit: ${audit.passed ? "PASS" : "FAIL"} — ${audit.findings.length} finding(s)` +
      (auditCodes.length === 0 ? "" : `: ${auditCodes.slice(0, MAX_LISTED).join(", ")}${auditCodes.length > MAX_LISTED ? ", …" : ""}`),
  ];
  for (const finding of [...blockerFindings, ...gate.findings.filter((f) => f.severity === "major")].slice(0, MAX_LISTED)) {
    lines.push(`  ${describe(finding)}`);
  }

  return {
    passed: gate.passed,
    blockers: blockerFindings.length,
    majors,
    minors,
    blockerFindings,
    lines,
    refusal: gate.passed
      ? ""
      : `V25_RELEASE_BLOCKED: the candidate fails its own book gate (${blockerFindings.length} blocker finding(s)) — ` +
        "refusing to advance the pointer or publish a reader package for a book the gate rejects. " +
        "Repair the findings above and re-run the release against the repaired candidate.",
  };
}
