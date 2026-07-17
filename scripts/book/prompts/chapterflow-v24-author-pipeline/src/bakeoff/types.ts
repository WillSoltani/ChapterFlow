/**
 * Model bake-off — shared typed contracts.
 *
 * A bake-off generates the SAME book with N candidate author models over ONE
 * frozen set of shared inputs (draft, research, source-v2, packets, design,
 * briefs), validates every candidate with the existing deterministic gates,
 * compares candidates through the existing BLINDED review machinery under
 * opaque labels, selects ONE global winner, and only then promotes the winner
 * into canonical state for the normal formal QC + publish lifecycle.
 *
 * Everything here is a THIN orchestration layer: content validity is owned by
 * the existing critics/gates, reviews by src/review/*, formal QC + publish by
 * the existing book-autopilot / publish-final path. This module only decides
 * WHAT runs WHERE, and keeps candidates isolated until selection.
 */

export const BAKEOFF_MANIFEST_SCHEMA = "model-bakeoff-manifest-v1" as const;
export const BAKEOFF_REPORT_SCHEMA = "model-bakeoff-report-v1" as const;

/** The bake-off phases, in lifecycle order. The manifest records the highest
 *  COMPLETED phase; resume re-enters at the first incomplete one. */
export const BAKEOFF_PHASES = [
  "intake",
  "research",
  "freeze",
  "preflight",
  "candidates",
  "validate",
  "review",
  "select",
  "promote",
  "qc",
  "report",
] as const;
export type BakeoffPhase = (typeof BAKEOFF_PHASES)[number];

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

/** One candidate author model under comparison. */
export type CandidateSpec = {
  /** Exact codex model id (e.g. "gpt-5.6-sol") — passed as `-c model=<id>`. */
  model: string;
  /** Filesystem-safe slug for the durable candidates/<slug>/ tree. */
  slug: string;
  /** Opaque generation slot (w1/w2/w3) — the ONLY candidate token that may appear
   *  inside an author prompt (as part of the output path). Never derived from the
   *  model name, so a candidate model never sees its own identity. */
  slot: string;
  effort: ReasoningEffort;
};

// ── Draft intake ──────────────────────────────────────────────────────────────

export type DraftIntakeV1 = {
  schemaVersion: "model-bakeoff-draft-intake-v1";
  /** Original file name + the resolved absolute path it was read from. */
  originalFileName: string;
  resolvedPath: string;
  fileType: "md" | "txt" | "pdf" | "docx";
  /** SHA-256 of the original draft bytes. */
  sha256: string;
  byteLength: number;
  /** How text was extracted ("verbatim" for md/txt; the tool used for pdf/docx). */
  extractionMethod: string;
  /** SHA-256 of the extracted text artifact. */
  extractedTextSha256: string;
  extractedTextChars: number;
  /** Run-relative paths of the immutable copies. */
  storedDraftRelPath: string;
  storedTextRelPath: string;
  /** Identity resolution. */
  title: string | null;
  author: string | null;
  bookId: string;
  /** How title/author were resolved and how much to trust them for PUBLICATION. */
  identitySource: "override" | "front-matter" | "heading" | "filename" | "unresolved";
  identityConfident: boolean;
  overrides: { title?: string; author?: string; bookId?: string };
  intakeAt: string;
};

// ── Shared-input freeze ───────────────────────────────────────────────────────

export type FrozenFileV1 = {
  /** Pipeline-relative path of the LIVE artifact the candidates consume. */
  relPath: string;
  sha256: string;
  bytes: number;
};

export type SharedInputsFreezeV1 = {
  schemaVersion: "model-bakeoff-shared-inputs-v1";
  frozenAt: string;
  /** Every shared input, hashed. Candidates fail closed if any of these drift
   *  between freeze and the end of candidate generation. */
  files: FrozenFileV1[];
  /** Combined hash over `files` (sorted by relPath) — the run's input identity. */
  combinedSha256: string;
  /** SHA-256 of the author task-card TEMPLATE: a card built from the frozen
   *  inputs with the output path replaced by a fixed placeholder. Byte-equal
   *  across candidates by construction; recorded so the report can prove it. */
  taskCardTemplateSha256: Record<string, string>;
  /** The write-phase retry budget every candidate gets (recorded for fairness). */
  retryBudget: { gateRetries: number; leadDegradeRetries: number };
  chapterNumbers: number[];
};

// ── Candidate generation + validation ────────────────────────────────────────

export type CandidateChapterAttemptV1 = {
  attempt: number;
  sessionId: string;
  ok: boolean;
  durationMs: number;
  /** Why the attempt failed (gate blockers / rubric / contract / spawn), "" on success. */
  failure: string;
};

export type CandidateChapterResultV1 = {
  chapterNumber: number;
  ok: boolean;
  /** True iff attempt 1 passed every write-time check (gate + rubric + contract). */
  firstAttemptPass: boolean;
  attempts: CandidateChapterAttemptV1[];
  totalDurationMs: number;
  contentSha256: string | null;
  reason?: string;
};

export type CandidateValidationV1 = {
  schemaVersion: "model-bakeoff-candidate-validation-v1";
  model: string;
  validatedAt: string;
  complete: boolean;
  /** Blockers from the existing deterministic battery (book-gate, reader budgets,
   *  ship-gate re-run, rubric metrics, quiz keys). Any entry ⇒ ineligible. */
  hardFailures: string[];
  advisories: string[];
  bookGatePassed: boolean;
  rubricVerdict: "pass" | "warn" | "fail";
  readerBudgetBlockers: number;
  shipGateBlockers: number;
};

export type CandidateStateV1 = {
  schemaVersion: "model-bakeoff-candidate-v1";
  spec: CandidateSpec;
  status: "pending" | "generating" | "complete" | "failed";
  chapters: CandidateChapterResultV1[];
  totalDurationMs: number;
  totalRetries: number;
  firstAttemptPasses: number;
  startedAt?: string;
  completedAt?: string;
};

// ── Blinded review ────────────────────────────────────────────────────────────

export type BlindLabel = "A" | "B" | "C" | "D" | "E" | "F";

export type CandidateChapterReviewV1 = {
  chapterNumber: number;
  composite: number;
  ship: boolean;
  keysClean: boolean;
  valid: boolean;
  pass: boolean;
  reviewerSessionId: string;
};

export type CandidateBookReadV1 = {
  readerNo: number;
  sessionId: string;
  composite: number | null;
  gate: "PASS" | "FAIL" | null;
  churn: string;
  valid: boolean;
  invalidReason?: string;
};

/**
 * WP-702: the codex whole-book panel review is DEMOTED to a NON-BLOCKING ADVISORY
 * signal. Every field on this record (bookComposite / bookGate / bookChurn /
 * meanChapterComposite / …) is ADVISORY only — a recorded cross-model read that
 * NEVER changes eligibility or the primary ranking. The PRIMARY selection metric
 * is the Claude-side D7 rubric-audit composite (CandidateD7JudgmentV1), mirrored
 * onto the optional d7* fields below for report visibility.
 */
export type CandidateReviewV1 = {
  schemaVersion: "model-bakeoff-candidate-review-v1";
  /** The opaque label reviewers saw. The label→model mapping lives ONLY in the
   *  manifest + final report, never in anything a reviewer reads. */
  label: BlindLabel;
  /** Combined content hash of the reviewed chapters — a resumed run reuses this
   *  review only while the candidate bytes are unchanged. */
  contentSha256: string;
  chapterReviews: CandidateChapterReviewV1[];
  bookReads: CandidateBookReadV1[];
  /** ADVISORY (non-blocking): composeBookVerdict outputs pooled over the book reads. */
  bookComposite: number | null;
  bookGate: "PASS" | "FAIL" | null;
  bookChurn: string;
  meanChapterComposite: number | null;
  minChapterComposite: number | null;
  chapterPassRate: number | null;
  sampledChapterNumbers: number[];
  reviewedAt: string;
  /** PRIMARY (mirrored from the authoritative CandidateD7JudgmentV1 for report
   *  visibility): the Claude-side D7 chapter-diagnostic composite + its gate
   *  results. Undefined on an advisory-only record. */
  d7Composite?: number | null;
  d7CoreDomainMins?: number[] | null;
  d7GatesPass?: boolean | null;
  d7LayerIndependencePass?: boolean | null;
};

// ── D7 judge (PRIMARY selection metric — Claude-side rubric-audit) ─────────────

export type CandidateD7ChapterResultV1 = {
  unit: string;
  chapterNumber: number;
  chapterDiagnostic: number;
  coreDomainMin: number;
  coreDomainsPass: boolean;
  gatesPass: boolean;
  layerIndependencePass: boolean;
  pass: boolean;
};

/**
 * WP-702: the PRIMARY bake-off selection metric. Produced by driving the
 * Claude-side D7 rubric-audit harness (rubricAuditHarness.ts) over an APP-FAITHFUL
 * audit package assembled from the candidate's slot chapters — NEVER a codex
 * model read. A null `d7Composite` (assembly refused / audit not driven) makes the
 * candidate INELIGIBLE; it must never silently fall back to the codex advisory
 * composite.
 */
export type CandidateD7JudgmentV1 = {
  schemaVersion: "model-bakeoff-candidate-d7-v1";
  label: BlindLabel;
  /** Combined content hash of the judged chapters — a resumed run reuses this D7
   *  judgment only while the candidate bytes are unchanged. */
  contentSha256: string;
  /** The retained rubric-audit id (kebab; e.g. `bakeoff-<runId>-<label>`). */
  auditId: string;
  /** report.summary.mean — the chapter-diagnostic composite (book CDS). Null when
   *  the audit package could not fail-closed-assemble (candidate INELIGIBLE). */
  d7Composite: number | null;
  /** Per-chapter core-domain minimum averages (rubric Domains 1-6). */
  d7CoreDomainMins: number[];
  /** report.summary.allGatesPass — every required base gate passed on every chapter. */
  d7GatesPass: boolean;
  /** report.summary.allLayerIndependencePass — every read layer self-contained. */
  d7LayerIndependencePass: boolean;
  /** report.summary.allCoreDomainsPass — the core-domain floor held on every chapter. */
  allCoreDomainsPass: boolean;
  /** report.summary.min — the weakest chapter diagnostic. */
  min: number | null;
  meanPass: boolean;
  minPass: boolean;
  calibrationPass: boolean;
  verdict: "PASS" | "FAIL" | "VOID_CALIBRATION" | null;
  chapters: CandidateD7ChapterResultV1[];
  /** Set (with d7Composite null) when the candidate's chapters could not be
   *  fail-closed-assembled into an audit package — the candidate is INELIGIBLE. */
  ineligibleReason?: string;
  judgedAt: string;
};

// ── Selection ─────────────────────────────────────────────────────────────────

export type CandidateScorecardV1 = {
  model: string;
  label: BlindLabel;
  eligible: boolean;
  disqualifications: string[];
  /** PRIMARY (WP-702): the Claude-side D7 chapter-diagnostic composite + gates —
   *  the sole ranking metric and (with the deterministic floor) the eligibility gate. */
  d7Composite: number | null;
  d7CoreDomainMins: number[] | null;
  d7GatesPass: boolean | null;
  d7LayerIndependencePass: boolean | null;
  d7Min: number | null;
  d7Verdict: "PASS" | "FAIL" | "VOID_CALIBRATION" | null;
  /** ADVISORY (non-blocking): the codex whole-book panel read — recorded, never
   *  used for eligibility or ranking. */
  bookComposite: number | null;
  bookGate: "PASS" | "FAIL" | null;
  churn: string;
  meanChapterComposite: number | null;
  minChapterComposite: number | null;
  chapterPassRate: number | null;
  firstAttemptPasses: number;
  totalRetries: number;
  totalDurationMs: number;
};

export type SelectionV1 = {
  schemaVersion: "model-bakeoff-selection-v1";
  selectedAt: string;
  winner: string | null;
  runnerUp: string | null;
  /** True when the top candidates were inside the ±2.0 D7 selection band and the
   *  winner was chosen on the tie-break ladder (worst-chapter D7 min, then retries,
   *  then latency — WP-705 owns the full ladder). */
  decidedByTieBreak: boolean;
  tieBand: number;
  scorecards: CandidateScorecardV1[];
  /** Ordered human-readable decision trace (one line per hierarchy step). */
  reasons: string[];
  perChapterWinners: Array<{ chapterNumber: number; model: string | null; composites: Record<string, number | null> }>;
};

// ── Promotion ─────────────────────────────────────────────────────────────────

export type PromotionRecordV1 = {
  schemaVersion: "model-bakeoff-promotion-v1";
  promotedAt: string;
  winnerModel: string;
  winnerEffort: ReasoningEffort;
  runId: string;
  chapterFiles: Array<{ relPath: string; sha256: string }>;
  byteIdentityVerified: boolean;
  sharedInputsSha256: string;
  taskCardTemplateSha256: Record<string, string>;
  candidateChapterHashes: Record<string, Record<string, string | null>>;
  authorSessionIds: Record<string, string>;
};

// ── Manifest (the run's single source of truth; drives resume) ───────────────

export type BakeoffManifestV1 = {
  schemaVersion: typeof BAKEOFF_MANIFEST_SCHEMA;
  runId: string;
  bookId: string;
  createdAt: string;
  updatedAt: string;
  candidates: CandidateSpec[];
  judge: { model: string; effort: ReasoningEffort };
  maxParallel: number;
  /** Candidate runs are ALWAYS no-publish; this only gates the post-QC step of
   *  the SELECTED winner through the existing verified publish path. */
  publish: boolean;
  /** Secret blind mapping (label → model). Lives here, outside every reviewer-
   *  visible artifact; revealed only in the final report. */
  blindMap: Record<string, string>;
  /** Highest fully-completed phase per BAKEOFF_PHASES order. */
  completedPhases: BakeoffPhase[];
  intake?: DraftIntakeV1;
  freeze?: SharedInputsFreezeV1;
  preflight?: {
    checkedAt: string;
    codexVersion: string | null;
    models: Array<{ model: string; ok: boolean; detail: string }>;
  };
  selection?: SelectionV1;
  promotion?: PromotionRecordV1;
  qc?: {
    startedAt: string;
    outcome: string;
    publishAuthorized: boolean;
    detail: string;
  };
  haltReason?: string;
};
