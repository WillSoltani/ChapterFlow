import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";

import { chapterContentHash, isAttestationFresh, loadAttestation, writeAttestation, type QcAttestation, type QcVerdict } from "../../critics/qcAttestation.js";
import { writeFileAtomic } from "../../lib/atomicWrite.js";
import { AXIS_WEIGHTS, combineBarAxes, computeVerdict, type AxisScore, type FailureTier } from "../../critics/semantic/publishableBar.js";
import type { ChapterV21 } from "../../types.js";
import { loadBookChapters, loadManualKeyJudge, manualKeyJudgePath, resolveManualKeyJudges, type ManualKeyJudgeRecord } from "../manualKeyJudge.js";
import { unresolvedMajors, type MajorFindingSnapshot } from "../majorDisposition.js";
import { sourceHashFor } from "../sourceV2Gate.js";
import { loadSweepRecord, sweepChapterStatus, sweepRecordPath, writeSweepRecordFromSubmission } from "../sweep.js";
import { evaluateDeterministic } from "./deterministicGate.js";
import {
  barArtifactPath,
  BAR_READ_VARIANTS,
  confirmArtifactPath,
  evidenceMatrixPath,
  loadBarReadArtifact,
  loadConfirmReadArtifact,
  orchestratorRoundDir,
  qcSummaryPath,
  repairBriefPath,
  repairLedgerPath,
  repairPromptPath,
  roundRecordPath,
  submissionsDir,
  type BarReadVariant,
} from "./artifacts.js";
import { appendFindings, effectiveLedger, hasBlockingAuthority, ledgerStatusSummary, migrateRawSemanticLedgerFindings, supersedeMissingEffectiveFindings, type EffectiveLedgerFinding } from "./ledger.js";
import { allFindingsFabricated, nondistinctiveRepetitionQuote, quoteGroundedInChapter, searchableChapterText } from "./findingValidity.js";
import { findingsFromEvidenceDecision, type FinalizerRawEvidence } from "./finalizerFindings.js";
import { writeRepairBrief } from "./repairBrief.js";
import { certificationSessionFailures, currentSessionId, loadAuthorProvenance } from "../sessionProvenance.js";
import { validateSubmission, type FindingProvenanceSource, type SubmissionRole, type ValidatedBarReadSubmission, type ValidatedSubmission, type ValidatedSweepSubmission } from "./schemas.js";
import { withQcTransaction } from "./transaction.js";

export type EvidenceStatus =
  | "PASS"
  | "FAIL"
  | "MISSING"
  | "STALE"
  | "NEEDS_ADJUDICATION"
  | "NOT_APPLICABLE";

export type EvidenceChapterDecision = {
  bookId: string;
  roundId: string;
  chapterNumber: number;
  chapterId: string;
  contentHash: string;
  sourceHash?: string | null;
  checks: {
    sourceV2: EvidenceStatus;
    shipGate: EvidenceStatus;
    authorCheck: EvidenceStatus;
    intraBook: EvidenceStatus;
    bookGate: EvidenceStatus;
    sweep: EvidenceStatus;
    manualKeyJudge: EvidenceStatus;
    barRead: "GREEN" | "YELLOW" | "RED" | "MISSING" | "STALE";
    confirmRead: "PUBLISHABLE" | "REVISE" | "CORRUPTION" | "MISSING" | "STALE";
    repairLedger: "NO_OPEN_BLOCKERS" | "OPEN_FINDINGS" | "NEEDS_QC_RERUN";
    majors: EvidenceStatus;
    // SP plan-conformance (shape obedience, within-chapter shape reuse, exemplar
    // ownership). Shifted left from the publish preflight so a QC verdict predicts
    // publish — a deterministic check, recomputed fresh for every chapter.
    planEnforcement: EvidenceStatus;
  };
  majorStatus: {
    status: EvidenceStatus;
    chapter: MajorFindingSnapshot[];
    book: MajorFindingSnapshot[];
  };
  finalVerdict: "PUBLISHABLE" | "REVISE" | "CORRUPTION" | "NEEDS_MORE_QC";
  reason: string;
  evidence: {
    manualKeyJudgePath?: string;
    sweepPath?: string;
    barReadPath?: string;
    confirmReadPath?: string;
    repairLedgerPath?: string;
    repairBriefPath?: string;
  };
};

export type FinalizeQcRoundResult = {
  ok: boolean;
  allPublishable: boolean;
  repairRequired: boolean;
  incomplete: boolean;
  evidenceMatrixPath: string;
  repairBriefPath: string;
  repairPromptPath: string;
  attestationsWritten: number;
  chapters: EvidenceChapterDecision[];
  errors: string[];
};

function readJson(path: string): any | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function selectedChapterNumbers(bookId: string, roundId: string, options: { chapters?: number[] }): number[] | undefined {
  if (options.chapters?.length) return [...new Set(options.chapters)].sort((a, b) => a - b);
  const round = readJson(roundRecordPath(bookId, roundId));
  if (Array.isArray(round?.chapters) && round.chapters.length) {
    const nums = round.chapters.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0) as number[];
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  return undefined;
}

function submissionFilesForRole(bookId: string, roundId: string, role: SubmissionRole): string[] {
  const dir = submissionsDir(bookId, roundId, role);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !f.endsWith(".meta.json"))
    .filter((f) => !/^ch\d+\.(bar-read|confirm-read)\.json$/.test(f))
    .sort()
    .map((f) => resolve(dir, f));
}

function latestValidSubmissionWithPath<T extends ValidatedSubmission>(bookId: string, roundId: string, role: SubmissionRole): { submission: T; path: string } | null {
  const files = submissionFilesForRole(bookId, roundId, role);
  for (const path of files.slice().reverse()) {
    const raw = readJson(path);
    const validation = validateSubmission(bookId, roundId, role, raw);
    if (validation.ok) return { submission: validation.submission as T, path };
  }
  return null;
}

function injectedBarAxes(bar: NonNullable<ReturnType<typeof loadBarReadArtifact>>, keyStatus: ManualKeyJudgeRecord["status"] | "MISSING"): AxisScore[] {
  if (bar.schemaVersion === "qc-bar-read-v1") return bar.axes;
  let keyAxis: AxisScore;
  if (keyStatus === "PASS") {
    keyAxis = { axis: "quiz_key_correctness", score: 1, tier: "PUBLISHABLE", hits: [] };
  } else if (keyStatus === "CORRUPTION") {
    keyAxis = { axis: "quiz_key_correctness", score: 0, tier: "CORRUPTION", hits: [{ unitId: "manual-keyjudge", quote: "keyA/keyB agree against stored key", defect: "Manual keyjudge found a wrong stored quiz key." }] };
  } else {
    keyAxis = { axis: "quiz_key_correctness", score: 0, tier: "GENERATED_DRAFT" as FailureTier, hits: [] };
  }
  return [keyAxis, ...bar.axes];
}

function ledgerFindingsForChapter(bookId: string, roundId: string, chapterNumber: number) {
  return effectiveLedger(bookId, roundId).filter((f) => {
    if (!hasBlockingAuthority(f)) return false;
    if (f.chapterNumber === chapterNumber) return true;
    return (f.chapters ?? []).includes(chapterNumber);
  });
}

function currentNegativeAttestationBlocksPublishable(bookId: string, chapter: ChapterV21): string | null {
  const existing = loadAttestation(bookId, chapter.number);
  if (!existing || existing.verdict === "PUBLISHABLE") return null;
  if (!isAttestationFresh(existing, chapter)) return null;
  return `fresh ${existing.verdict} attestation on unchanged content requires repair or a human supersede`;
}

function attestationForDecision(chapter: ChapterV21, decision: EvidenceChapterDecision, verdict: QcVerdict, findings: string[]): QcAttestation {
  const existing = loadAttestation(decision.bookId, chapter.number);
  const { history: _history, ...existingSansHistory } = existing ?? {};
  const publishable = verdict === "PUBLISHABLE";
  // Idempotent re-finalize: if an existing attestation already records THIS verdict on
  // THIS content for THIS round, nothing about the review changed — preserve its
  // reviewedAt / reviewerSessionId / history so the written file is BYTE-IDENTICAL.
  // (Re-stamping a fresh timestamp + growing history on every finalize made a
  // `--include-state` re-publish stage a phantom diff, defeating the publish-idempotency
  // guard and re-creating the duplicate publish commit the guard exists to prevent.)
  const unchanged = !!existing
    && existing.verdict === verdict
    && existing.contentHash === decision.contentHash
    && existing.roundId === decision.roundId;
  const reviewedAt = unchanged && typeof existing!.reviewedAt === "string" ? existing!.reviewedAt : new Date().toISOString();
  const reviewerSessionId = unchanged ? existing!.reviewerSessionId : currentSessionId();
  const history = unchanged
    ? existing!.history
    : (existing ? [...(existing.history ?? []), existingSansHistory as any].slice(-10) : undefined);
  return {
    schemaVersion: "qc-attest-v1",
    bookId: decision.bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict,
    contentHash: decision.contentHash,
    hashVersion: "v2",
    reviewer: `codex-qc:auto:${decision.roundId}`,
    reviewedAt,
    reviewerSessionId,
    roundId: decision.roundId,
    roundRole: publishable ? "confirm" : "attest",
    dimensions: {
      sourceV2: decision.checks.sourceV2 === "PASS",
      shipGate: decision.checks.shipGate === "PASS",
      bookGate: decision.checks.bookGate === "PASS",
      sweepClean: decision.checks.sweep === "PASS",
      keysCorrect: decision.checks.manualKeyJudge === "PASS",
      barGreen: decision.checks.barRead === "GREEN",
      confirmPassed: decision.checks.confirmRead === "PUBLISHABLE",
      noOpenRepairFindings: decision.checks.repairLedger === "NO_OPEN_BLOCKERS",
    },
    evidence: {
      orchestratorRoundId: decision.roundId,
      evidenceMatrixPath: evidenceMatrixPath(decision.bookId, decision.roundId),
      manualKeyJudgePath: decision.evidence.manualKeyJudgePath,
      sweepPath: decision.evidence.sweepPath,
      barReadPath: decision.evidence.barReadPath,
      confirmReadPath: decision.evidence.confirmReadPath,
      repairLedgerPath: decision.evidence.repairLedgerPath,
      repairBriefPath: decision.evidence.repairBriefPath,
    },
    findings,
    notes: `qc-orchestrator finalize: ${decision.finalVerdict}; ${decision.reason}`,
    history,
  };
}

function summarizeFindings(bookId: string, roundId: string, chapterNumber: number): string[] {
  return ledgerFindingsForChapter(bookId, roundId, chapterNumber)
    .slice(0, 8)
    .map((f) => `${f.severity} ${f.findingId} ${f.unitId}: ${f.problem}`);
}

function unresolvedMajorsForChapter(unresolved: MajorFindingSnapshot[], chapterNumber: number): EvidenceChapterDecision["majorStatus"] {
  const chapter = unresolved.filter((f) => f.scope.startsWith(`chapter:${chapterNumber}:`));
  const book = unresolved.filter((f) => f.scope === "book");
  return {
    status: chapter.length || book.length ? "FAIL" : "PASS",
    chapter,
    book,
  };
}

function confirmHasUnactionableDecision(confirm: NonNullable<ReturnType<typeof loadConfirmReadArtifact>> | null): boolean {
  return !!confirm && (confirm.decision === "REVISE" || confirm.decision === "CORRUPTION") && confirm.findings.length === 0;
}

function activeLedgerFindingsForDecision(bookId: string, roundId: string, chapterNumber: number) {
  return effectiveLedger(bookId, roundId).filter((f) => {
    if (!hasBlockingAuthority(f)) return false;
    if (f.chapterNumber === undefined && (!f.chapters || f.chapters.length === 0)) return true;
    if (f.chapterNumber === chapterNumber) return true;
    return (f.chapters ?? []).includes(chapterNumber);
  });
}

const BAR_AXIS_IDS = new Set(Object.keys(AXIS_WEIGHTS));
const SWEEP_REPAIR_CLASSES = new Set(["scene_skeleton", "persona_drift", "repeated_unit", "location_stamping"]);

function otherwisePublishableExceptLedger(decision: EvidenceChapterDecision): boolean {
  const c = decision.checks;
  return c.sourceV2 === "PASS" &&
    c.shipGate === "PASS" &&
    c.authorCheck === "PASS" &&
    c.intraBook === "PASS" &&
    c.bookGate === "PASS" &&
    c.sweep === "PASS" &&
    c.manualKeyJudge === "PASS" &&
    c.barRead === "GREEN" &&
    c.confirmRead === "PUBLISHABLE" &&
    c.majors === "PASS" &&
    c.planEnforcement === "PASS";
}

function sameSourceParityContradiction(decision: EvidenceChapterDecision, finding: EffectiveLedgerFinding): boolean {
  if (SWEEP_REPAIR_CLASSES.has(finding.repairClass) || SWEEP_REPAIR_CLASSES.has(finding.globalTheme)) return decision.checks.sweep === "PASS";
  if (BAR_AXIS_IDS.has(finding.repairClass) || BAR_AXIS_IDS.has(finding.globalTheme)) return decision.checks.barRead === "GREEN";
  if (finding.repairClass === "confirm" || finding.repairClass === "confirm_read" || finding.globalTheme === "confirm" || finding.globalTheme === "confirm_read") {
    return decision.checks.confirmRead === "PUBLISHABLE";
  }
  return false;
}

function sourceKind(value: unknown): "raw_submission" | "derived_artifact" {
  return value === "raw_submission" || value === "derived_artifact" ? value : "derived_artifact";
}

function rawProvenance(role: Exclude<SubmissionRole, "keyA" | "keyB" | "major">, fallbackFile: string, artifact: unknown): FindingProvenanceSource {
  const stamped = artifact as { rawSubmissionFile?: string; rawEvidenceSourceId?: string; rawEvidenceSourceKind?: unknown };
  return {
    sourceRole: role,
    submissionFile: stamped.rawSubmissionFile ?? fallbackFile,
    sourceId: stamped.rawEvidenceSourceId,
    sourceKind: sourceKind(stamped.rawEvidenceSourceKind),
  };
}

function barReadEntries(bookId: string, roundId: string, chapterNumber: number): Array<{ variant?: BarReadVariant; read: ValidatedBarReadSubmission; path: string }> {
  const primary = loadBarReadArtifact(bookId, roundId, chapterNumber);
  if (!primary) return [];
  const out: Array<{ variant?: BarReadVariant; read: ValidatedBarReadSubmission; path: string }> = [{
    read: primary,
    path: barArtifactPath(bookId, roundId, chapterNumber),
  }];
  for (const variant of BAR_READ_VARIANTS) {
    const read = loadBarReadArtifact(bookId, roundId, chapterNumber, variant);
    if (read) out.push({ variant, read, path: barArtifactPath(bookId, roundId, chapterNumber, variant) });
  }
  return out;
}

function finalizeQcRoundUnlocked(bookId: string, roundId: string, options: { chapters?: number[]; attest?: boolean; dryRun?: boolean } = {}): FinalizeQcRoundResult {
  // dryRun computes the same decisions in-memory but writes NOTHING durable
  // (no attestations, evidence matrix, qc-summary, repair brief, ledger, or
  // sweep record). A preflight must never mutate QC state — re-finalizing with
  // attest:true used to overwrite a fresh PUBLISHABLE attestation with REVISE.
  const errors: string[] = [];
  if (!options.dryRun) mkdirSync(orchestratorRoundDir(bookId, roundId), { recursive: true });

  const sweepSubmission = latestValidSubmissionWithPath<ValidatedSweepSubmission>(bookId, roundId, "sweep");
  if (sweepSubmission && !options.dryRun) {
    try {
      writeSweepRecordFromSubmission(sweepSubmission.submission, sweepSubmission.path);
    } catch (err) {
      errors.push(`sweep-record: ${(err as Error).message}`);
    }
  }
  if (!options.dryRun) migrateRawSemanticLedgerFindings(bookId, roundId);

  const allChapters = loadBookChapters(bookId);
  // Chapter text lookup so the fabrication guard can substring-verify a sweep finding's
  // quote against the chapters it names (the paraphrased-composite guard).
  const chapterTextByNumber = new Map<number, string>();
  for (const ch of allChapters) chapterTextByNumber.set(ch.number, searchableChapterText(ch));
  const getChapterText = (n: number) => chapterTextByNumber.get(n);
  // A sweep whose findings ALL cite non-existent chapter fields, OR whose quotes appear
  // in none of the chapters they name, is fabricated and provides no valid evidence —
  // it must not gate the book as REVISE.
  const sweepAllFabricated = !!sweepSubmission && allFindingsFabricated(sweepSubmission.submission.findings, { getChapterText });
  const keyResolution = resolveManualKeyJudges(bookId, roundId);
  if (keyResolution.errors.length) errors.push(...keyResolution.errors.map((e) => `manual-keyjudge: ${e}`));
  // NOTE: we deliberately do NOT backfill round.chapterContentHashes from
  // current content here. Doing so blessed already-edited content as the
  // freshness baseline (the highest-risk edit lands between round creation and
  // first finalize). Hashes are recorded once, at round creation
  // (createQcOrchestrationRound); a round that predates that is treated as
  // stale by checkRoundFreshness and must be re-opened.
  const selectedSet = selectedChapterNumbers(bookId, roundId, options);
  const chapters = selectedSet ? allChapters.filter((ch) => selectedSet.includes(ch.number)) : allChapters;
  // P2 — chapters this incremental round carried (no fresh per-chapter cards).
  // Only present on incremental rounds; the attestation freshness check below is
  // the authority, so this set alone never carries a chapter.
  const roundRecord = readJson(roundRecordPath(bookId, roundId));
  const carriedSet: Set<number> | null = Array.isArray(roundRecord?.carriedChapters)
    ? new Set(roundRecord.carriedChapters.map((n: unknown) => Number(n)))
    : null;
  const unresolvedMajorFindings = unresolvedMajors(bookId, chapters, true);
  // The six DETERMINISTIC checks (source-v2, ship-gate, author-check, intra-book,
  // book-gate, plan-enforcement) come from the SHARED evaluator that `qc-converge`
  // also calls — so a clean qc-converge provably predicts that finalize raises no
  // deterministic finding (this is what ends the stale-round treadmill on a
  // mechanical nit). The semantic + round-state checks (sweep, key, bar, confirm,
  // repair-ledger, majors) are still computed per-chapter below. Book-gate +
  // plan-enforcement are evaluated once over the whole book inside the evaluator
  // (exemplar ownership + cross-chapter patterns are book-wide).
  const det = evaluateDeterministic(bookId, chapters, allChapters);
  const bookGate = det.bookGate;
  let sweepRecord: ReturnType<typeof loadSweepRecord> = null;
  try {
    sweepRecord = loadSweepRecord(bookId);
  } catch (err) {
    errors.push(`sweep-history: ${(err as Error).message}`);
  }
  // A non-PASS sweep whose submitted findings ALL got dropped by the family mapper (e.g.
  // mislabeled factual) leaves an empty WRITTEN record. sweepChapterStatus then FAILs every
  // chapter, but there are no actionable ledger findings — so finalize would REVISE→demote
  // every chapter to NEEDS_MORE_QC with NO repair target, dead-ending the round (an
  // unrecoverable INCOMPLETE halt). Treat that like a fabricated sweep: route to "re-run the
  // sweep", never a targetless REVISE. Computed from the SUBMISSION-had-findings vs
  // WRITTEN-record-empty gap so it fires ONLY on the drop case (not on a reviewer who
  // genuinely cited nothing, which still fails closed).
  const sweepDroppedAllFindings =
    !!sweepSubmission && (sweepSubmission.submission.findings?.length ?? 0) > 0 && (sweepRecord?.findings?.length ?? 0) === 0;
  if (sweepDroppedAllFindings) {
    console.warn(`[finalize] sweep for ${bookId} round ${roundId}: all ${sweepSubmission!.submission.findings.length} submitted finding(s) were dropped by the family mapper → empty written record; routing to re-run-sweep instead of a targetless REVISE.`);
  }
  const briefPath = repairBriefPath(bookId, roundId);
  const promptPath = repairPromptPath(bookId, roundId);
  const decisions: EvidenceChapterDecision[] = [];
  const rawByChapter = new Map<number, FinalizerRawEvidence>();
  let attestationsWritten = 0;

  for (const ch of chapters) {
    const contentHash = chapterContentHash(ch);
    const sourceHash = sourceHashFor(bookId, ch.number);
    // Deterministic checks + their raw gate outputs from the shared evaluator.
    const dch = det.perChapter.get(ch.number)!;
    const { source, shipGate, authorFindings, intraFindings, planFindings: chapterPlanFindings } = dch.raw;
    const keyJudge = loadManualKeyJudge(bookId, ch.number);
    const bar = loadBarReadArtifact(bookId, roundId, ch.number);
    const confirm = loadConfirmReadArtifact(bookId, roundId, ch.number);
    const barEntries = barReadEntries(bookId, roundId, ch.number);
    let effectiveBar: ValidatedBarReadSubmission | null = null;
    const ledgerFindings = ledgerFindingsForChapter(bookId, roundId, ch.number);
    const needsQcRerun = ledgerFindings.some((f) => f.status === "needs_qc_rerun");
    const openSerious = ledgerFindings.some((f) => f.severity === "blocker" || f.severity === "major");
    const majorStatus = unresolvedMajorsForChapter(unresolvedMajorFindings, ch.number);

    const checks: EvidenceChapterDecision["checks"] = {
      sourceV2: dch.checks.sourceV2,
      shipGate: dch.checks.shipGate,
      authorCheck: dch.checks.authorCheck,
      intraBook: dch.checks.intraBook,
      bookGate: dch.checks.bookGate,
      sweep: "MISSING",
      manualKeyJudge: "MISSING",
      barRead: "MISSING",
      confirmRead: "MISSING",
      repairLedger: needsQcRerun ? "NEEDS_QC_RERUN" : openSerious ? "OPEN_FINDINGS" : "NO_OPEN_BLOCKERS",
      majors: majorStatus.status,
      planEnforcement: dch.checks.planEnforcement,
    };

    {
      // A book-level sweep REVISE only FAILS the chapters its findings name (see
      // sweepChapterStatus) — clean, unnamed chapters stay publishable candidates
      // instead of stranding in the [re-QC only] bucket. MISSING leaves the default.
      const sweepStatus = sweepChapterStatus(sweepRecord ?? null, ch.number, contentHash, roundId);
      if (sweepStatus !== "MISSING") checks.sweep = sweepStatus;
    }

    if (keyJudge) {
      if (keyJudge.contentHash !== contentHash || keyJudge.sourceHash !== (sourceHash ?? "")) checks.manualKeyJudge = "STALE";
      else if (keyJudge.status === "PASS") checks.manualKeyJudge = "PASS";
      else if (keyJudge.status === "CORRUPTION") checks.manualKeyJudge = "FAIL";
      else if (keyJudge.status === "NEEDS_ADJUDICATION") checks.manualKeyJudge = "NEEDS_ADJUDICATION";
      else checks.manualKeyJudge = "MISSING";
    }

    let barGate: "GREEN" | "YELLOW" | "RED" | "MISSING" | "STALE" = "MISSING";
    if (bar) {
      if (bar.chapterId !== ch.chapterId || bar.contentHash !== contentHash) barGate = "STALE";
      else {
        const keyStatus = keyJudge?.status ?? "MISSING";
        // WS-1: fold the primary read together with any matching tiebreak variants (t2/t3)
        // by per-axis median before computing the verdict — variance-smoothing the borderline
        // flap. With one read this is the identity; a cited corruption is never medianed away.
        const reads = barEntries.map((entry) => entry.read).filter((r) => r.chapterId === ch.chapterId && r.contentHash === contentHash);
        const combinedBar = { ...bar, axes: combineBarAxes(reads.map((r) => r.axes)) };
        effectiveBar = combinedBar;
        barGate = computeVerdict(ch.chapterId, injectedBarAxes(combinedBar, keyStatus), true).gate;
      }
    }
    checks.barRead = barGate;

    if (confirm) {
      if (confirm.chapterId !== ch.chapterId || confirm.contentHash !== contentHash) checks.confirmRead = "STALE";
      else checks.confirmRead = confirm.decision;
    }

    // P2 — incremental carry-forward. A chapter the round carried got no fresh
    // bar/confirm/key cards, so its per-chapter axes read MISSING. Inherit its
    // prior INDEPENDENT positive read for THOSE axes ONLY — every cross-chapter
    // signal (sweep, book-gate, majors, repair-ledger, ship-gate, author-check)
    // was evaluated fresh above and is untouched, so a sibling's repair that newly
    // implicates this carried chapter still demotes it (checks.sweep === "FAIL" →
    // REVISE below). The fresh prior PUBLISHABLE attestation is the authority; if
    // the chapter was edited after round creation, isAttestationFresh fails and it
    // is NOT carried (→ NEEDS_MORE_QC, correctly re-reviewed).
    if (carriedSet?.has(ch.number) && checks.barRead === "MISSING") {
      const carried = loadAttestation(bookId, ch.number);
      if (carried && carried.verdict === "PUBLISHABLE" && isAttestationFresh(carried, ch)) {
        checks.barRead = "GREEN";
        checks.confirmRead = "PUBLISHABLE";
        checks.manualKeyJudge = "PASS";
      }
    }

    // FIX 2a (generalized) — a cross-chapter sweep finding legitimately demotes a chapter ONLY when
    // its quote is textually GROUNDED in THAT chapter. The stochastic sweep reviewer can OVER-NAME:
    // the-undoing-project r20260620134645 flagged scene_skeleton 'in the Hebrew University seminar
    // room' across ALL 12 chapters when the phrase appears in exactly ONE, collapsing the book
    // 11/12 -> 0/12. A finding whose quote appears NOWHERE in a chapter cannot implicate it — so
    // clear the sweep FAIL for ANY chapter (carried OR freshly reviewed) whose every gating finding
    // is ungrounded in it. This used to protect only CARRIED chapters (a banked high-water-mark);
    // a fabricated finding demotes a fresh chapter just as wrongly, so the guard now applies to all.
    // `quoteGroundedInChapter` is fail-closed (a non-discriminating short quote, or unreadable
    // chapter text, counts as grounded), so a real blocker grounded in THIS chapter STILL demotes
    // (floor preserved) — only a verifiable ABSENCE clears. Non-distinctive repetition quotes and
    // advisories are already non-gating in sweepChapterStatus, so they are excluded from `naming`
    // here too (else a fail-closed short quote would spuriously keep the FAIL).
    if (checks.sweep === "FAIL" && sweepRecord) {
      const naming = (sweepRecord.findings ?? []).filter(
        (f) => f.severity !== "advisory" && !nondistinctiveRepetitionQuote(f) && (f.chapters ?? []).includes(ch.number),
      );
      const grounded = naming.some((f) => quoteGroundedInChapter(f.quote, getChapterText(ch.number) ?? ""));
      if (naming.length > 0 && !grounded) checks.sweep = "PASS";
    }

    const missingRequired = [checks.sweep, checks.manualKeyJudge, checks.sourceV2, checks.barRead].some((s) => s === "MISSING" || s === "STALE");
    const publishableCandidate = checks.manualKeyJudge === "PASS" &&
      checks.barRead === "GREEN" &&
      checks.sweep === "PASS" &&
      checks.sourceV2 === "PASS" &&
      checks.shipGate === "PASS" &&
      checks.authorCheck === "PASS" &&
      checks.intraBook === "PASS" &&
      checks.bookGate === "PASS" &&
      checks.repairLedger === "NO_OPEN_BLOCKERS" &&
      checks.majors === "PASS" &&
      checks.planEnforcement === "PASS";
    const confirmMissingForCandidate = publishableCandidate && (checks.confirmRead === "MISSING" || checks.confirmRead === "STALE");
    const sameReviewerConfirm = publishableCandidate && bar && confirm && bar.reviewer === confirm.reviewer && confirm.decision === "PUBLISHABLE";
    // Session independence: reviewer subagents stamp their own CHAPTERFLOW_SESSION_ID,
    // and publishable certification requires those ids plus author provenance.
    // each reviewer subagent stamps its own CHAPTERFLOW_SESSION_ID, captured per submission.
    // These turn "separate reviewers" from a derived role-string label into recorded evidence:
    // author≠sweep/bar/confirm, sweep≠bar/confirm, bar≠confirm, and bar≠tiebreak variants.
    const authorProvenance = loadAuthorProvenance(ch.chapterId);
    const authorSessionId = authorProvenance?.authorSessionId;
    const barReadSessions = bar
      ? barEntries.map((entry) => entry.read).filter((r) => r.chapterId === ch.chapterId && r.contentHash === contentHash).map((r) => r.reviewerSessionId)
      : [];
    const provenanceFailures = publishableCandidate
      ? certificationSessionFailures({
          chapterId: ch.chapterId,
          bookRound: `${bookId}/${roundId}`,
          authorSessionId,
          sweepSessionId: sweepRecord?.reviewerSessionId,
          barSessionId: bar?.reviewerSessionId,
          confirmSessionId: confirm?.reviewerSessionId,
          barReadSessionIds: barReadSessions,
        })
      : [];
    const missingIndependentProvenance = provenanceFailures.filter((failure) => failure.code.startsWith("missing_"));
    const collisionProvenance = provenanceFailures.find((failure) => !failure.code.startsWith("missing_"));
    // P1.5 — a sub-0.6 bar axis with no cited hit is no longer "unactionable":
    // finalizerFindings now synthesises a major repair finding for it, so it
    // routes to REVISE (via the barRead === "YELLOW" disjunction below) with a
    // real target instead of dead-ending in NEEDS_MORE_QC.
    const unactionableConfirm = publishableCandidate && confirmHasUnactionableDecision(confirm);
    // A fabricated sweep (verdict FAIL, all findings cite non-existent fields) is
    // excluded from the REVISE trigger so the chapter's REAL failures still drive
    // the verdict; if nothing else fails it routes to NEEDS_MORE_QC (re-run the
    // sweep), never PUBLISHABLE on an invalid sweep.
    const unactionableSweep = checks.sweep === "FAIL" && (sweepAllFabricated || sweepDroppedAllFindings);
    const sweepBlocks = checks.sweep !== "PASS" && !unactionableSweep;

    let finalVerdict: EvidenceChapterDecision["finalVerdict"] = "NEEDS_MORE_QC";
    let reason = "";
    if (missingRequired) {
      reason = "required QC artifact is missing or stale";
    } else if (confirmMissingForCandidate) {
      reason = "publishable candidate is missing a fresh confirm read";
    } else if (missingIndependentProvenance.length > 0) {
      reason = `publishable certification requires recorded session provenance; legacy/unknown evidence cannot certify independence: ${missingIndependentProvenance.map((failure) => failure.message).join("; ")}`;
    } else if (sameReviewerConfirm) {
      reason = "confirm reviewer must differ from bar reviewer";
    } else if (collisionProvenance) {
      reason = `${collisionProvenance.message} — dispatch the affected read in a fresh independent session`;
    } else if (unactionableConfirm) {
      reason = "confirm read returned a non-publishable decision without quote-backed findings";
    } else if (keyJudge?.status === "CORRUPTION" || checks.barRead === "RED" || (publishableCandidate && checks.confirmRead === "CORRUPTION")) {
      finalVerdict = "CORRUPTION";
      reason = keyJudge?.status === "CORRUPTION" ? keyJudge.reason : publishableCandidate && checks.confirmRead === "CORRUPTION" ? confirm?.reason ?? "confirm read found corruption" : "bar read found a corruption-tier defect";
    } else if (
      checks.sourceV2 !== "PASS" ||
      checks.shipGate !== "PASS" ||
      checks.authorCheck !== "PASS" ||
      checks.intraBook !== "PASS" ||
      checks.bookGate !== "PASS" ||
      sweepBlocks ||
      checks.manualKeyJudge !== "PASS" ||
      checks.barRead === "YELLOW" ||
      (publishableCandidate && checks.confirmRead === "REVISE") ||
      checks.repairLedger !== "NO_OPEN_BLOCKERS" ||
      checks.majors !== "PASS" ||
      checks.planEnforcement !== "PASS"
    ) {
      finalVerdict = "REVISE";
      reason = checks.planEnforcement !== "PASS"
        ? "chapter violates its dealt plan (scene shape, shape reuse, or exemplar ownership) — caught at QC, not deferred to publish"
        : checks.majors !== "PASS"
        ? "one or more current major findings are unresolved or not round-backed"
        : publishableCandidate && checks.confirmRead === "REVISE" ? confirm?.reason ?? "confirm read requires revision" : "one or more gates, reads, or repair-ledger checks require revision";
    } else if (unactionableSweep) {
      // Nothing real failed, but the sweep verdict was non-pass on fabricated
      // findings — don't publish on an invalid sweep; ask for a fresh one.
      reason = "sweep returned a non-pass verdict but its finding(s) cite a chapter field that does not exist — re-run the sweep";
    } else {
      const block = currentNegativeAttestationBlocksPublishable(bookId, ch);
      // P1.4 — a chapter REVISE'd in an earlier round (typically by a since-
      // resolved book-wide major) is otherwise pinned forever: on byte-identical
      // content the stale REVISE attestation blocks PUBLISHABLE and the chapter
      // reads NEEDS_MORE_QC with no path forward. Let THIS round's complete,
      // independently-reviewed positive read supersede it — but ONLY a full pass
      // driven by two DISTINCT reviewers (bar GREEN + a different confirm reviewer
      // PUBLISHABLE, majors PASS, ledger clean), never the mere absence of
      // findings, so author≠reviewer is preserved and a writer cannot self-certify.
      const completeFreshPositive =
        publishableCandidate &&               // bar GREEN + key/sweep/gates PASS + majors PASS + ledger clean, all fresh
        checks.confirmRead === "PUBLISHABLE" && // a fresh, same-hash confirm decision...
        !sameReviewerConfirm;                  // ...from a reviewer DISTINCT from the bar reviewer
      // Require a v2 (full-coverage) prior hash so "byte-identical content" is
      // genuinely true: a v1 attestation's freshness uses the include-list
      // projection and a v1-invisible edit could change the real (v2) content
      // while still reading "fresh", so a legacy v1 REVISE is NOT self-superseded
      // (it falls through to the block → NEEDS_MORE_QC, human supersede). Current-
      // flow attestations are always v2, so this never affects a normal round.
      const existing = loadAttestation(bookId, ch.number);
      const priorRoundStale = !!existing && existing.hashVersion === "v2" && !!existing.roundId && existing.roundId !== roundId;
      if (block && !(completeFreshPositive && priorRoundStale)) {
        reason = block;
      } else {
        finalVerdict = "PUBLISHABLE";
        reason = block
          ? "superseded a stale prior-round non-publishable attestation on byte-identical content via a complete fresh positive read (bar GREEN + independent confirm PUBLISHABLE + majors PASS + ledger clean)"
          : confirm?.reason ?? "all required no-api QC evidence is fresh and publishable";
      }
    }

    const decision: EvidenceChapterDecision = {
      bookId,
      roundId,
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash,
      sourceHash,
      checks,
      majorStatus,
      finalVerdict,
      reason,
      evidence: {
        manualKeyJudgePath: keyJudge ? manualKeyJudgePath(bookId, ch.number) : undefined,
        sweepPath: sweepRecord ? sweepRecordPath(bookId) : undefined,
        barReadPath: bar ? barArtifactPath(bookId, roundId, ch.number) : undefined,
        confirmReadPath: confirm ? confirmArtifactPath(bookId, roundId, ch.number) : undefined,
        repairLedgerPath: repairLedgerPath(bookId, roundId),
        repairBriefPath: briefPath,
      },
    };
    decisions.push(decision);
    rawByChapter.set(ch.number, {
      source,
      authorFindings,
      shipGate,
      intraFindings,
      bookGate,
      sweepRecord,
      keyJudge,
      bar: effectiveBar ?? bar,
      confirm,
      confirmAccepted: publishableCandidate,
      planFindings: chapterPlanFindings,
      sweepSources: sweepRecord ? [rawProvenance("sweep", sweepRecordPath(bookId), sweepRecord)] : [],
      barSources: barEntries.map((entry) => rawProvenance("bar", entry.path, entry.read)),
      confirmSources: confirm ? [rawProvenance("confirm", confirmArtifactPath(bookId, roundId, ch.number), confirm)] : [],
    });
  }

  const effectiveFailureChapters = {
    sweep: new Set(decisions.filter((d) => d.checks.sweep === "FAIL").map((d) => d.chapterNumber)),
    bookGate: new Set(decisions.filter((d) => d.checks.bookGate === "FAIL").map((d) => d.chapterNumber)),
  };
  for (const raw of rawByChapter.values()) raw.effectiveFailureChapters = effectiveFailureChapters;

  const finalizerFindings = decisions.flatMap((decision) => {
    const raw = rawByChapter.get(decision.chapterNumber);
    return raw ? findingsFromEvidenceDecision(decision, raw) : [];
  });
  if (!options.dryRun) {
    const merged = appendFindings({
      bookId,
      roundId,
      role: "finalizer",
      submissionFile: "evidence-matrix.json",
      findings: finalizerFindings,
    });
    supersedeMissingEffectiveFindings(bookId, roundId, merged.findingIds);
  }

  for (const decision of decisions) {
    if (!carriedSet?.has(decision.chapterNumber)) continue;
    if (decision.finalVerdict !== "REVISE" || decision.checks.repairLedger === "NO_OPEN_BLOCKERS") continue;
    if (!otherwisePublishableExceptLedger(decision)) continue;
    const active = activeLedgerFindingsForDecision(bookId, roundId, decision.chapterNumber);
    if (active.length === 0 || active.every((f) => sameSourceParityContradiction(decision, f))) {
      const detail = active.length
        ? active.map((f) => `${f.findingId}:${f.repairClass}`).join(", ")
        : "no authoritative active findings remain after effective ledger rebuild";
      errors.push(`repair-ledger parity contradiction for carried publishable ch${decision.chapterNumber}: ${detail}`);
      decision.finalVerdict = "NEEDS_MORE_QC";
      decision.reason = "repair-ledger parity contradiction after effective decision rebuild; refusing to dispatch a repair for a carried publishable chapter";
    }
  }

  for (const decision of decisions) {
    if ((decision.finalVerdict === "REVISE" || decision.finalVerdict === "CORRUPTION") && activeLedgerFindingsForDecision(bookId, roundId, decision.chapterNumber).length === 0) {
      decision.finalVerdict = "NEEDS_MORE_QC";
      decision.reason = "non-publishable decision lacked actionable repair evidence";
    }
  }

  const matrixPath = evidenceMatrixPath(bookId, roundId);
  if (!options.dryRun) mkdirSync(dirname(matrixPath), { recursive: true });
  if (!options.dryRun) writeFileAtomic(matrixPath, JSON.stringify({
    schemaVersion: "qc-evidence-matrix-v1",
    bookId,
    roundId,
    generatedAt: new Date().toISOString(),
    chapters: decisions,
    errors,
  }, null, 2) + "\n");

  const writtenBriefPath = options.dryRun ? briefPath : writeRepairBrief(bookId, roundId);

  if (options.attest !== false && !options.dryRun) {
    const chapterByNumber = new Map(chapters.map((ch) => [ch.number, ch]));
    for (const decision of decisions) {
      if (decision.finalVerdict === "NEEDS_MORE_QC") continue;
      // P2 — a carried chapter that stayed PUBLISHABLE keeps its PRIOR attestation
      // (and that round's still-valid, same-hash bar/confirm artifacts, which
      // promote re-verifies). Re-attesting here would stamp THIS round, which has
      // no fresh bar/confirm for a carried chapter, and promote would then reject
      // it (QC0.bar_read_missing). A carried chapter that was genuinely DEMOTED this
      // round (a GROUNDED defect survived Fix 2a's re-validation) falls through and
      // overwrites its prior PUBLISHABLE — a real defect must lose its high-water-mark
      // so it is re-reviewed next round, never carried/promoted on a stale pass.
      if (carriedSet?.has(decision.chapterNumber) && decision.finalVerdict === "PUBLISHABLE") continue;
      const ch = chapterByNumber.get(decision.chapterNumber);
      if (!ch) continue;
      const verdict: QcVerdict = decision.finalVerdict;
      if (!currentSessionId()) {
        errors.push(`attestation for ${ch.chapterId} requires CHAPTERFLOW_SESSION_ID so reviewerSessionId provenance can be stamped`);
        continue;
      }
      const findings = decision.finalVerdict === "PUBLISHABLE" ? [] : summarizeFindings(bookId, roundId, ch.number);
      writeAttestation(attestationForDecision(ch, decision, verdict, findings));
      attestationsWritten++;
    }
  }

  const incomplete = decisions.some((d) => d.finalVerdict === "NEEDS_MORE_QC");
  const repairRequired = decisions.some((d) => d.finalVerdict === "REVISE" || d.finalVerdict === "CORRUPTION");
  const allPublishable = decisions.length > 0 && decisions.every((d) => d.finalVerdict === "PUBLISHABLE");
  const result: FinalizeQcRoundResult = {
    ok: errors.length === 0 && !incomplete && allPublishable,
    allPublishable,
    repairRequired,
    incomplete,
    evidenceMatrixPath: matrixPath,
    repairBriefPath: writtenBriefPath,
    repairPromptPath: promptPath,
    attestationsWritten,
    chapters: decisions,
    errors,
  };
  if (!options.dryRun) writeFileAtomic(qcSummaryPath(bookId, roundId), JSON.stringify({
    bookId,
    roundId,
    finalizedAt: new Date().toISOString(),
    evidenceMatrix: matrixPath,
    repairBrief: briefPath,
    repairPrompt: promptPath,
    ledger: ledgerStatusSummary(bookId, roundId),
    majors: {
      unresolved: unresolvedMajorFindings.length,
      book: unresolvedMajorFindings.filter((f) => f.scope === "book").length,
      chapter: unresolvedMajorFindings.filter((f) => f.scope.startsWith("chapter:")).length,
    },
    attestationsWritten,
    verdicts: {
      PUBLISHABLE: decisions.filter((d) => d.finalVerdict === "PUBLISHABLE").length,
      REVISE: decisions.filter((d) => d.finalVerdict === "REVISE").length,
      CORRUPTION: decisions.filter((d) => d.finalVerdict === "CORRUPTION").length,
      NEEDS_MORE_QC: decisions.filter((d) => d.finalVerdict === "NEEDS_MORE_QC").length,
    },
    errors,
  }, null, 2) + "\n");
  return result;
}

export function finalizeQcRound(bookId: string, roundId: string, options: { chapters?: number[]; attest?: boolean; dryRun?: boolean } = {}): FinalizeQcRoundResult {
  return withQcTransaction(bookId, roundId, "finalize", () => finalizeQcRoundUnlocked(bookId, roundId, options));
}
