import { AXIS_WEIGHTS, computeVerdict, type AxisHit, type AxisId, type AxisScore, type FailureTier, type PublishableVerdict } from "../../critics/semantic/publishableBar.js";

export const ORCHESTRATOR_SUBMISSION_SCHEMAS = [
  "qc-sweep-submission-v1",
  "qc-key-derive-v2",
  "qc-bar-read-v1",
  "qc-bar-read-v2",
  "qc-confirm-read-v1",
  "qc-major-triage-v1",
] as const;

export type OrchestratorSubmissionSchema = typeof ORCHESTRATOR_SUBMISSION_SCHEMAS[number];

// The four cross-chapter templating families are defined once in sweepSpec (the ONE spec the
// formal sweep and the pre-QC scout both speak). Imported for local validation use and
// re-exported so existing importers of SWEEP_FAMILIES from schemas.ts are unchanged.
import { SWEEP_FAMILIES, type SweepFamily } from "../sweepSpec.js";
export { SWEEP_FAMILIES };
export type { SweepFamily };

export const SUBMISSION_ROLES = ["sweep", "keyA", "keyB", "bar", "confirm", "major"] as const;
export type SubmissionRole = typeof SUBMISSION_ROLES[number];

export type FindingSeverity = "blocker" | "major" | "minor" | "advisory";

export type FindingProvenanceSource = {
  sourceRole: SubmissionRole;
  submissionFile: string;
  sourceId?: string;
  sourceKind?: "raw_submission" | "derived_artifact";
};

export type SubmissionFinding = {
  chapterNumber?: number;
  chapters?: number[];
  /** Optional reviewer-supplied stable key for a grounded sweep defect. Sweep
   *  ingestion verifies this against the server-derived key before persisting. */
  defectKey?: string;
  unitId: string;
  repairClass: string;
  severity: FindingSeverity;
  quote: string;
  problem: string;
  expectedFix: string;
  globalTheme?: string;
  provenanceSources?: FindingProvenanceSource[];
};

export type ValidatedSweepSubmission = {
  schemaVersion: "qc-sweep-submission-v1";
  bookId: string;
  roundId: string;
  role: "sweep";
  reviewer: string;
  reviewerSessionId?: string;
  verdict: "PASS" | "REVISE" | "CORRUPTION";
  checkedFamilies: SweepFamily[];
  findings: SubmissionFinding[];
};

export type ValidatedKeyDeriveSubmission = {
  schemaVersion: "qc-key-derive-v2";
  bookId: string;
  roundId: string;
  role: "keyA" | "keyB";
  reviewer?: string;
  reviewerSessionId?: string;
  chapters: Array<{
    chapterNumber: number;
    chapterId?: string;
    packHash: string;
    contentHash?: string;
    sourceHash?: string;
    answers: Array<{
      questionIndex: number;
      choiceIndex: number;
      confidence: number | "low" | "medium" | "high";
      reason: string;
      sourceFactIds: string[];
    }>;
  }>;
};

export type ValidatedBarReadSubmission = {
  schemaVersion: "qc-bar-read-v1" | "qc-bar-read-v2";
  bookId: string;
  roundId: string;
  role: "bar";
  reviewer: string;
  reviewerSessionId?: string;
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  sourceHash?: string | null;
  axes: AxisScore[];
  notes?: string;
  verdict: PublishableVerdict;
};

export type ValidatedConfirmReadSubmission = {
  schemaVersion: "qc-confirm-read-v1";
  bookId: string;
  roundId: string;
  role: "confirm";
  reviewer: string;
  reviewerSessionId?: string;
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  decision: "PUBLISHABLE" | "REVISE" | "CORRUPTION";
  reason: string;
  findings: SubmissionFinding[];
};

export type ValidatedMajorTriageSubmission = {
  schemaVersion: "qc-major-triage-v1";
  bookId: string;
  roundId: string;
  role: "major";
  reviewer: string;
  reviewerSessionId?: string;
  findings: SubmissionFinding[];
  dispositions: Array<{
    findingId: string;
    status: "open" | "waived_false_positive" | "waived_accepted_debt";
    reason: string;
  }>;
};

export type ValidatedSubmission =
  | ValidatedSweepSubmission
  | ValidatedKeyDeriveSubmission
  | ValidatedBarReadSubmission
  | ValidatedConfirmReadSubmission
  | ValidatedMajorTriageSubmission;

export type SubmissionValidationResult =
  | { ok: true; submission: ValidatedSubmission }
  | { ok: false; errors: string[] };

export type SubmissionValidationOptions = {
  /** Fresh qc-submit ingestion requires a local session id. Historical files are
   *  still parseable without it, but legacy/unknown provenance cannot certify
   *  reviewer independence at finalize. */
  requireReviewerSessionId?: boolean;
};

const AXES = Object.keys(AXIS_WEIGHTS) as AxisId[];
const NON_KEY_AXES = AXES.filter((axis) => axis !== "quiz_key_correctness");
const TIERS: FailureTier[] = ["CORRUPTION", "GENERATED_DRAFT", "PUBLISHABLE"];
const VERDICTS = ["PASS", "REVISE", "CORRUPTION"] as const;
const QC_DECISIONS = ["PUBLISHABLE", "REVISE", "CORRUPTION"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roleMatches(expected: SubmissionRole, actual: unknown, schema: OrchestratorSubmissionSchema): boolean {
  if (schema === "qc-key-derive-v2") return expected === actual;
  return expected === actual;
}

function normalizeSeverity(value: unknown): FindingSeverity {
  return value === "blocker" || value === "major" || value === "minor" || value === "advisory" ? value : "blocker";
}

function normalizeFinding(raw: any, errors: string[], context: string, defaults: Partial<SubmissionFinding> = {}): SubmissionFinding {
  const chapterNumber = Number(raw?.chapterNumber ?? raw?.chapter ?? defaults.chapterNumber);
  const chapters = Array.isArray(raw?.chapters) ? raw.chapters.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)) : defaults.chapters;
  const f: SubmissionFinding = {
    chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : undefined,
    chapters,
    defectKey: nonempty(raw?.defectKey) ? String(raw.defectKey) : defaults.defectKey,
    unitId: String(raw?.unitId ?? raw?.unit ?? defaults.unitId ?? ""),
    repairClass: String(raw?.repairClass ?? raw?.axis ?? raw?.family ?? defaults.repairClass ?? ""),
    severity: normalizeSeverity(raw?.severity ?? defaults.severity),
    quote: String(raw?.quote ?? defaults.quote ?? ""),
    problem: String(raw?.problem ?? raw?.defect ?? defaults.problem ?? ""),
    expectedFix: String(raw?.expectedFix ?? raw?.fix ?? defaults.expectedFix ?? ""),
    globalTheme: nonempty(raw?.globalTheme) ? String(raw.globalTheme) : defaults.globalTheme,
  };
  if (!f.unitId.trim()) errors.push(`${context}: unitId is required`);
  if (!f.repairClass.trim()) errors.push(`${context}: repairClass is required`);
  if (!f.quote.trim()) errors.push(`${context}: quote is required`);
  if (!f.problem.trim()) errors.push(`${context}: problem is required`);
  if (!f.expectedFix.trim()) errors.push(`${context}: expectedFix is required`);
  return f;
}

function normalizeFindings(raw: unknown, errors: string[], context: string, defaults: Partial<SubmissionFinding> = {}): SubmissionFinding[] {
  if (!Array.isArray(raw)) {
    errors.push(`${context}: findings[] is required`);
    return [];
  }
  return raw.map((f, i) => normalizeFinding(f, errors, `${context}.findings[${i}]`, defaults));
}

function validateEnvelope(bookId: string, roundId: string, role: SubmissionRole, raw: any, schema: OrchestratorSubmissionSchema, errors: string[]): void {
  if (raw?.schemaVersion !== schema) errors.push(`schemaVersion must be ${schema}`);
  if (raw?.bookId !== bookId) errors.push(`bookId mismatch: expected ${bookId}, got ${String(raw?.bookId)}`);
  if (raw?.roundId !== roundId) errors.push(`roundId mismatch: expected ${roundId}, got ${String(raw?.roundId)}`);
  if (!roleMatches(role, raw?.role, schema)) errors.push(`role mismatch: expected ${role}, got ${String(raw?.role)}`);
}

function validateReviewerSession(raw: any, errors: string[], options: SubmissionValidationOptions): void {
  if (options.requireReviewerSessionId && !nonempty(raw?.reviewerSessionId)) {
    errors.push("reviewerSessionId is required for new QC submissions; set CHAPTERFLOW_SESSION_ID before qc-submit");
  }
}

function confidenceValid(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 1;
  return value === "low" || value === "medium" || value === "high";
}

function validateSweep(bookId: string, roundId: string, role: SubmissionRole, raw: any, options: SubmissionValidationOptions): SubmissionValidationResult {
  const errors: string[] = [];
  validateEnvelope(bookId, roundId, role, raw, "qc-sweep-submission-v1", errors);
  validateReviewerSession(raw, errors, options);
  if (role !== "sweep") errors.push("qc-sweep-submission-v1 must be submitted with role sweep");
  if (!nonempty(raw?.reviewer)) errors.push("reviewer is required");
  if (!(VERDICTS as readonly string[]).includes(raw?.verdict)) errors.push("verdict must be PASS, REVISE, or CORRUPTION");
  const checkedFamilies = Array.isArray(raw?.checkedFamilies)
    ? raw.checkedFamilies.filter((f: unknown): f is SweepFamily => (SWEEP_FAMILIES as readonly string[]).includes(String(f)))
    : [];
  const unknownFamilies = Array.isArray(raw?.checkedFamilies)
    ? raw.checkedFamilies.filter((f: unknown) => !(SWEEP_FAMILIES as readonly string[]).includes(String(f)))
    : [];
  if (!Array.isArray(raw?.checkedFamilies)) errors.push("checkedFamilies[] is required");
  for (const f of unknownFamilies) errors.push(`unknown checkedFamily: ${String(f)}`);
  if (raw?.verdict === "PASS") {
    for (const f of SWEEP_FAMILIES) {
      if (!checkedFamilies.includes(f)) errors.push(`PASS requires checkedFamilies to include ${f}`);
    }
  }
  const findings = normalizeFindings(raw?.findings, errors, "sweep", { severity: raw?.verdict === "PASS" ? "advisory" : "blocker" });
  if (Array.isArray(raw?.findings)) {
    raw.findings.forEach((finding: any, i: number) => {
      if (!isObject(finding) || !(SWEEP_FAMILIES as readonly string[]).includes(String(finding.family))) {
        errors.push(`sweep.findings[${i}].family must be one of ${SWEEP_FAMILIES.join(", ")}`);
      }
      const chapters = Array.isArray(finding?.chapters)
        ? finding.chapters.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
        : [];
      if (chapters.length === 0) errors.push(`sweep.findings[${i}].chapters must list affected chapters`);
    });
  }
  if (raw?.verdict === "PASS" && findings.some((f) => f.severity === "blocker" || f.severity === "major")) {
    errors.push("PASS sweep submission may include advisory observations only; blocker/major findings require REVISE or CORRUPTION");
  }
  if ((raw?.verdict === "REVISE" || raw?.verdict === "CORRUPTION") && findings.length === 0) {
    errors.push(`${raw.verdict} sweep submission requires at least one quote-backed finding`);
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    submission: {
      schemaVersion: "qc-sweep-submission-v1",
      bookId,
      roundId,
      role: "sweep",
      reviewer: String(raw.reviewer),
      reviewerSessionId: nonempty(raw?.reviewerSessionId) ? String(raw.reviewerSessionId) : undefined,
      verdict: raw.verdict,
      checkedFamilies,
      findings,
    },
  };
}

function validateKeyDerive(bookId: string, roundId: string, role: SubmissionRole, raw: any, options: SubmissionValidationOptions): SubmissionValidationResult {
  const errors: string[] = [];
  validateEnvelope(bookId, roundId, role, raw, "qc-key-derive-v2", errors);
  validateReviewerSession(raw, errors, options);
  if (role !== "keyA" && role !== "keyB") errors.push("qc-key-derive-v2 must be submitted with role keyA or keyB");
  if (!Array.isArray(raw?.chapters)) errors.push("chapters[] is required");
  const chapters = Array.isArray(raw?.chapters) ? raw.chapters.map((entry: any, ci: number) => {
    const n = Number(entry?.chapterNumber);
    if (!Number.isInteger(n) || n < 1) errors.push(`chapters[${ci}].chapterNumber must be a positive integer`);
    if (!nonempty(entry?.packHash)) errors.push(`chapters[${ci}].packHash is required`);
    if (!Array.isArray(entry?.answers)) errors.push(`chapters[${ci}].answers[] is required`);
    const answers = Array.isArray(entry?.answers) ? entry.answers.map((ans: any, ai: number) => {
      const questionIndex = Number(ans?.questionIndex);
      const choiceIndex = Number(ans?.choiceIndex);
      const reason = String(ans?.reason ?? "");
      const sourceFactIds = Array.isArray(ans?.sourceFactIds) ? ans.sourceFactIds.map(String).filter(Boolean) : [];
      // Require an actual number — NOT a coercible value. Number(null)===0 and
      // Number("")===0 would otherwise let an unfilled `choiceIndex: null` (the
      // review-packet skeleton seed) pass as a silent answer index 0, which would
      // corrupt the wrong-key catch. An unfilled index must FAIL, not mean 0.
      if (typeof ans?.questionIndex !== "number" || !Number.isInteger(ans.questionIndex) || ans.questionIndex < 0) errors.push(`chapters[${ci}].answers[${ai}].questionIndex must be a non-negative integer`);
      if (typeof ans?.choiceIndex !== "number" || !Number.isInteger(ans.choiceIndex) || ans.choiceIndex < 0) errors.push(`chapters[${ci}].answers[${ai}].choiceIndex must be a non-negative integer`);
      if (!confidenceValid(ans?.confidence)) errors.push(`chapters[${ci}].answers[${ai}].confidence is required and must be 0..1, low, medium, or high`);
      if (reason.trim().length < 40) errors.push(`chapters[${ci}].answers[${ai}].reason must be at least 40 characters`);
      if (sourceFactIds.length === 0) errors.push(`chapters[${ci}].answers[${ai}].sourceFactIds must cite at least one source fact`);
      return { questionIndex, choiceIndex, confidence: ans?.confidence, reason, sourceFactIds };
    }) : [];
    return {
      chapterNumber: n,
      chapterId: nonempty(entry?.chapterId) ? String(entry.chapterId) : undefined,
      packHash: String(entry?.packHash ?? ""),
      contentHash: nonempty(entry?.contentHash) ? String(entry.contentHash) : undefined,
      sourceHash: nonempty(entry?.sourceHash) ? String(entry.sourceHash) : undefined,
      answers,
    };
  }) : [];
  if (errors.length) return { ok: false, errors };
  return { ok: true, submission: { schemaVersion: "qc-key-derive-v2", bookId, roundId, role: role as "keyA" | "keyB", reviewer: nonempty(raw?.reviewer) ? String(raw.reviewer) : undefined, reviewerSessionId: nonempty(raw?.reviewerSessionId) ? String(raw.reviewerSessionId) : undefined, chapters } };
}

function normalizeHit(raw: any, errors: string[], context: string): AxisHit {
  const hit: AxisHit = { unitId: String(raw?.unitId ?? raw?.unit ?? ""), quote: String(raw?.quote ?? ""), defect: String(raw?.defect ?? raw?.problem ?? "") };
  // OPTIONAL concrete remediation (accept `fix` or `expectedFix`). Omitted when blank so
  // legacy submissions stay byte-identical and findingsFromSubmission falls back cleanly.
  const fix = String(raw?.fix ?? raw?.expectedFix ?? "").trim();
  if (fix) hit.fix = fix;
  if (!hit.unitId.trim()) errors.push(`${context}.unitId is required`);
  if (!hit.quote.trim()) errors.push(`${context}.quote is required`);
  if (!hit.defect.trim()) errors.push(`${context}.defect is required`);
  return hit;
}

function validateBar(bookId: string, roundId: string, role: SubmissionRole, raw: any, schema: "qc-bar-read-v1" | "qc-bar-read-v2", options: SubmissionValidationOptions): SubmissionValidationResult {
  const errors: string[] = [];
  validateEnvelope(bookId, roundId, role, raw, schema, errors);
  validateReviewerSession(raw, errors, options);
  if (role !== "bar") errors.push(`${schema} must be submitted with role bar`);
  if (!nonempty(raw?.reviewer)) errors.push("reviewer is required");
  const chapterNumber = Number(raw?.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) errors.push("chapterNumber must be a positive integer");
  if (!nonempty(raw?.chapterId)) errors.push("chapterId is required");
  if (!nonempty(raw?.contentHash)) errors.push("contentHash is required");
  if (!Array.isArray(raw?.axes)) errors.push("axes[] is required");
  const seen = new Set<string>();
  const axes: AxisScore[] = [];
  const requiredAxes = schema === "qc-bar-read-v2" ? NON_KEY_AXES : AXES;
  if (Array.isArray(raw?.axes)) {
    for (let i = 0; i < raw.axes.length; i++) {
      const a = raw.axes[i];
      const axis = a?.axis;
      if (!AXES.includes(axis)) {
        errors.push(`axes[${i}].axis is unknown: ${String(axis)}`);
        continue;
      }
      if (schema === "qc-bar-read-v2" && axis === "quiz_key_correctness") {
        errors.push("qc-bar-read-v2 must not include quiz_key_correctness; finalizer injects it from manual keyjudge");
        continue;
      }
      if (seen.has(axis)) errors.push(`duplicate axis ${axis}`);
      seen.add(axis);
      if (!finiteNumber(a?.score) || a.score < 0 || a.score > 1) errors.push(`axes[${i}].score must be 0..1`);
      if (!TIERS.includes(a?.tier)) errors.push(`axes[${i}].tier must be CORRUPTION, GENERATED_DRAFT, or PUBLISHABLE`);
      const hits = Array.isArray(a?.hits) ? a.hits.map((h: any, hi: number) => normalizeHit(h, errors, `axes[${i}].hits[${hi}]`)) : [];
      if (a?.tier === "CORRUPTION" && hits.length === 0) errors.push(`axes[${i}] CORRUPTION requires at least one cited hit`);
      if (finiteNumber(a?.score) && a.score < 0.6 && hits.length === 0) errors.push(`axes[${i}] score < 0.6 requires at least one cited hit`);
      axes.push({ axis, score: Number(a?.score), tier: a?.tier, hits });
    }
  }
  for (const axis of requiredAxes) if (!seen.has(axis)) errors.push(`missing axis ${axis}`);
  const verdictAxes = schema === "qc-bar-read-v2"
    ? [{ axis: "quiz_key_correctness" as AxisId, score: 1, tier: "PUBLISHABLE" as FailureTier, hits: [] }, ...axes]
    : axes;
  const verdict = computeVerdict(String(raw?.chapterId ?? ""), verdictAxes, true);
  if (verdict.gate !== "GREEN" && !String(raw?.notes ?? "").trim() && axes.every((a) => a.hits.length === 0)) {
    errors.push("non-GREEN bar read requires notes or cited hits");
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    submission: {
      schemaVersion: schema,
      bookId,
      roundId,
      role: "bar",
      reviewer: String(raw.reviewer),
      reviewerSessionId: nonempty(raw?.reviewerSessionId) ? String(raw.reviewerSessionId) : undefined,
      chapterNumber,
      chapterId: String(raw.chapterId),
      contentHash: String(raw.contentHash),
      sourceHash: raw.sourceHash === null ? null : nonempty(raw.sourceHash) ? String(raw.sourceHash) : undefined,
      axes,
      notes: nonempty(raw?.notes) ? String(raw.notes) : undefined,
      verdict,
    },
  };
}

function validateConfirm(bookId: string, roundId: string, role: SubmissionRole, raw: any, options: SubmissionValidationOptions): SubmissionValidationResult {
  const errors: string[] = [];
  validateEnvelope(bookId, roundId, role, raw, "qc-confirm-read-v1", errors);
  validateReviewerSession(raw, errors, options);
  if (role !== "confirm") errors.push("qc-confirm-read-v1 must be submitted with role confirm");
  if (!nonempty(raw?.reviewer)) errors.push("reviewer is required");
  const chapterNumber = Number(raw?.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) errors.push("chapterNumber must be a positive integer");
  if (!nonempty(raw?.chapterId)) errors.push("chapterId is required");
  if (!nonempty(raw?.contentHash)) errors.push("contentHash is required");
  if (!(QC_DECISIONS as readonly string[]).includes(raw?.decision)) errors.push("decision must be PUBLISHABLE, REVISE, or CORRUPTION");
  const reason = String(raw?.reason ?? "");
  if (reason.trim().length < 40) errors.push("reason must be at least 40 characters");
  const findings = normalizeFindings(raw?.findings ?? [], errors, "confirm", { chapterNumber, repairClass: "confirm_read", severity: raw?.decision === "PUBLISHABLE" ? "advisory" : "blocker" });
  if (raw?.decision === "PUBLISHABLE" && findings.length > 0) errors.push("PUBLISHABLE confirm-read must not include open findings");
  if ((raw?.decision === "REVISE" || raw?.decision === "CORRUPTION") && findings.length === 0) errors.push(`${raw.decision} confirm-read requires at least one quote-backed finding`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, submission: { schemaVersion: "qc-confirm-read-v1", bookId, roundId, role: "confirm", reviewer: String(raw.reviewer), reviewerSessionId: nonempty(raw?.reviewerSessionId) ? String(raw.reviewerSessionId) : undefined, chapterNumber, chapterId: String(raw.chapterId), contentHash: String(raw.contentHash), decision: raw.decision, reason, findings } };
}

function validateMajor(bookId: string, roundId: string, role: SubmissionRole, raw: any, options: SubmissionValidationOptions): SubmissionValidationResult {
  const errors: string[] = [];
  validateEnvelope(bookId, roundId, role, raw, "qc-major-triage-v1", errors);
  validateReviewerSession(raw, errors, options);
  if (role !== "major") errors.push("qc-major-triage-v1 must be submitted with role major");
  if (!nonempty(raw?.reviewer)) errors.push("reviewer is required");
  const findings = normalizeFindings(raw?.findings ?? [], errors, "major", { repairClass: "major_triage", severity: "major" });
  const dispositions = Array.isArray(raw?.dispositions) ? raw.dispositions.map((d: any, i: number) => {
    if (!nonempty(d?.findingId)) errors.push(`dispositions[${i}].findingId is required`);
    if (!["open", "waived_false_positive", "waived_accepted_debt"].includes(d?.status)) errors.push(`dispositions[${i}].status must be open, waived_false_positive, or waived_accepted_debt`);
    const reason = String(d?.reason ?? "");
    if (reason.trim().length < 20) errors.push(`dispositions[${i}].reason must be at least 20 characters`);
    return { findingId: String(d?.findingId ?? ""), status: d?.status, reason };
  }) : [];
  if (!Array.isArray(raw?.dispositions)) errors.push("dispositions[] is required");
  if (errors.length) return { ok: false, errors };
  return { ok: true, submission: { schemaVersion: "qc-major-triage-v1", bookId, roundId, role: "major", reviewer: String(raw.reviewer), reviewerSessionId: nonempty(raw?.reviewerSessionId) ? String(raw.reviewerSessionId) : undefined, findings, dispositions } };
}

export function validateSubmission(bookId: string, roundId: string, role: SubmissionRole, raw: unknown, options: SubmissionValidationOptions = {}): SubmissionValidationResult {
  if (!isObject(raw)) return { ok: false, errors: ["submission must be a JSON object"] };
  switch (raw.schemaVersion) {
    case "qc-sweep-submission-v1":
      return validateSweep(bookId, roundId, role, raw, options);
    case "qc-key-derive-v2":
      return validateKeyDerive(bookId, roundId, role, raw, options);
    case "qc-bar-read-v1":
      return validateBar(bookId, roundId, role, raw, "qc-bar-read-v1", options);
    case "qc-bar-read-v2":
      return validateBar(bookId, roundId, role, raw, "qc-bar-read-v2", options);
    case "qc-confirm-read-v1":
      return validateConfirm(bookId, roundId, role, raw, options);
    case "qc-major-triage-v1":
      return validateMajor(bookId, roundId, role, raw, options);
    default:
      return { ok: false, errors: [`unknown schemaVersion: ${String((raw as any).schemaVersion)}`] };
  }
}

export function findingsFromSubmission(submission: ValidatedSubmission): SubmissionFinding[] {
  if (submission.schemaVersion === "qc-sweep-submission-v1") return submission.findings;
  if (submission.schemaVersion === "qc-confirm-read-v1") return submission.findings;
  if (submission.schemaVersion === "qc-major-triage-v1") return submission.findings;
  if (submission.schemaVersion === "qc-bar-read-v1" || submission.schemaVersion === "qc-bar-read-v2") {
    const out: SubmissionFinding[] = [];
    for (const axis of submission.axes) {
      for (const hit of axis.hits) {
        out.push({
          chapterNumber: submission.chapterNumber,
          unitId: hit.unitId,
          repairClass: axis.axis,
          severity: axis.tier === "CORRUPTION" ? "blocker" : axis.score < 0.6 ? "major" : "advisory",
          quote: hit.quote,
          problem: hit.defect,
          // Prefer the reviewer's concrete per-hit remediation; fall back to the formulaic
          // stub only when the bar omitted `fix` (legacy / a reviewer that skipped it).
          expectedFix: hit.fix?.trim() || `Repair the ${axis.axis} defect and re-run author checks before a fresh QC round.`,
          globalTheme: axis.axis,
        });
      }
    }
    return out;
  }
  return [];
}
