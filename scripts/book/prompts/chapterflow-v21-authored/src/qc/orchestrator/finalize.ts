import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { checkAuthoringContract } from "../../critics/authoringContract.js";
import { runBookGate } from "../../critics/bookGate.js";
import { runShipGate } from "../../critics/finalGate.js";
import { loadChapterSidecar } from "../../critics/sourceGrounding.js";
import { chapterContentHash, isAttestationFresh, loadAttestation, writeAttestation, type QcAttestation, type QcVerdict } from "../../critics/qcAttestation.js";
import { computeVerdict, type AxisScore, type FailureTier } from "../../critics/semantic/publishableBar.js";
import type { ChapterV21 } from "../../types.js";
import { runIntraBookChecks } from "../../critics/intraBook.js";
import { loadBookChapters, loadManualKeyJudge, manualKeyJudgePath, resolveManualKeyJudges, type ManualKeyJudgeRecord } from "../manualKeyJudge.js";
import { unresolvedMajors, type MajorFindingSnapshot } from "../majorDisposition.js";
import { checkSourceV2Gate, sourceHashFor } from "../sourceV2Gate.js";
import { loadSweepRecord, sweepRecordPath, writeSweepRecordFromSubmission } from "../sweep.js";
import {
  barArtifactPath,
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
} from "./artifacts.js";
import { appendFindings, effectiveLedger, ledgerStatusSummary } from "./ledger.js";
import { allFindingsFabricated } from "./findingValidity.js";
import { findingsFromEvidenceDecision, type FinalizerRawEvidence } from "./finalizerFindings.js";
import { writeRepairBrief } from "./repairBrief.js";
import { currentSessionId } from "../sessionProvenance.js";
import { validateSubmission, type SubmissionRole, type ValidatedSubmission, type ValidatedSweepSubmission } from "./schemas.js";

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

function latestValidSubmission<T extends ValidatedSubmission>(bookId: string, roundId: string, role: SubmissionRole): T | null {
  const files = submissionFilesForRole(bookId, roundId, role);
  for (const path of files.slice().reverse()) {
    const raw = readJson(path);
    const validation = validateSubmission(bookId, roundId, role, raw);
    if (validation.ok) return validation.submission as T;
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
    if (!(f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun")) return false;
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
  return {
    schemaVersion: "qc-attest-v1",
    bookId: decision.bookId,
    chapterNumber: chapter.number,
    chapterId: chapter.chapterId,
    verdict,
    contentHash: decision.contentHash,
    hashVersion: "v2",
    reviewer: `codex-qc:auto:${decision.roundId}`,
    reviewedAt: new Date().toISOString(),
    reviewerSessionId: currentSessionId(),
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
    history: existing ? [...(existing.history ?? []), existingSansHistory as any].slice(-10) : undefined,
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

function barHasUnactionableSubfloor(bar: NonNullable<ReturnType<typeof loadBarReadArtifact>> | null): boolean {
  return !!bar && bar.axes.some((axis) => axis.score < 0.6 && axis.hits.length === 0);
}

function confirmHasUnactionableDecision(confirm: NonNullable<ReturnType<typeof loadConfirmReadArtifact>> | null): boolean {
  return !!confirm && (confirm.decision === "REVISE" || confirm.decision === "CORRUPTION") && confirm.findings.length === 0;
}

function activeLedgerFindingsForDecision(bookId: string, roundId: string, chapterNumber: number) {
  return effectiveLedger(bookId, roundId).filter((f) => {
    if (!(f.status === "open" || f.status === "still_open" || f.status === "needs_qc_rerun")) return false;
    if (f.chapterNumber === undefined && (!f.chapters || f.chapters.length === 0)) return true;
    if (f.chapterNumber === chapterNumber) return true;
    return (f.chapters ?? []).includes(chapterNumber);
  });
}

export function finalizeQcRound(bookId: string, roundId: string, options: { chapters?: number[]; attest?: boolean; dryRun?: boolean } = {}): FinalizeQcRoundResult {
  // dryRun computes the same decisions in-memory but writes NOTHING durable
  // (no attestations, evidence matrix, qc-summary, repair brief, ledger, or
  // sweep record). A preflight must never mutate QC state — re-finalizing with
  // attest:true used to overwrite a fresh PUBLISHABLE attestation with REVISE.
  const errors: string[] = [];
  if (!options.dryRun) mkdirSync(orchestratorRoundDir(bookId, roundId), { recursive: true });

  const sweepSubmission = latestValidSubmission<ValidatedSweepSubmission>(bookId, roundId, "sweep");
  if (sweepSubmission && !options.dryRun) writeSweepRecordFromSubmission(sweepSubmission);
  // A sweep whose findings ALL cite non-existent chapter fields is fabricated and
  // provides no valid evidence — it must not gate the book as REVISE.
  const sweepAllFabricated = !!sweepSubmission && allFindingsFabricated(sweepSubmission.findings);
  const keyResolution = resolveManualKeyJudges(bookId, roundId);
  if (keyResolution.errors.length) errors.push(...keyResolution.errors.map((e) => `manual-keyjudge: ${e}`));

  const allChapters = loadBookChapters(bookId);
  // NOTE: we deliberately do NOT backfill round.chapterContentHashes from
  // current content here. Doing so blessed already-edited content as the
  // freshness baseline (the highest-risk edit lands between round creation and
  // first finalize). Hashes are recorded once, at round creation
  // (createQcOrchestrationRound); a round that predates that is treated as
  // stale by checkRoundFreshness and must be re-opened.
  const selectedSet = selectedChapterNumbers(bookId, roundId, options);
  const chapters = selectedSet ? allChapters.filter((ch) => selectedSet.includes(ch.number)) : allChapters;
  const unresolvedMajorFindings = unresolvedMajors(bookId, chapters, true);
  const bookGate = runBookGate(bookId, allChapters);
  const bookGateStatus: EvidenceStatus = bookGate.passed ? "PASS" : "FAIL";
  const sweepRecord = loadSweepRecord(bookId);
  const briefPath = repairBriefPath(bookId, roundId);
  const promptPath = repairPromptPath(bookId, roundId);
  const decisions: EvidenceChapterDecision[] = [];
  const rawByChapter = new Map<number, FinalizerRawEvidence>();
  let attestationsWritten = 0;

  for (const ch of chapters) {
    const contentHash = chapterContentHash(ch);
    const sourceHash = sourceHashFor(bookId, ch.number);
    const source = checkSourceV2Gate(bookId, [ch.number]);
    const shipGate = runShipGate(ch);
    const authorFindings = checkAuthoringContract(ch, { sidecar: loadChapterSidecar(ch.chapterId), filePath: `state/chapters/${ch.chapterId}.v21-native.chapter.json` });
    const intraFindings = runIntraBookChecks(ch, allChapters.filter((other) => other.number < ch.number));
    const keyJudge = loadManualKeyJudge(bookId, ch.number);
    const bar = loadBarReadArtifact(bookId, roundId, ch.number);
    const confirm = loadConfirmReadArtifact(bookId, roundId, ch.number);
    const ledgerFindings = ledgerFindingsForChapter(bookId, roundId, ch.number);
    const needsQcRerun = ledgerFindings.some((f) => f.status === "needs_qc_rerun");
    const openSerious = ledgerFindings.some((f) => f.severity === "blocker" || f.severity === "major");
    const majorStatus = unresolvedMajorsForChapter(unresolvedMajorFindings, ch.number);

    const checks: EvidenceChapterDecision["checks"] = {
      sourceV2: source.passed ? "PASS" : "FAIL",
      shipGate: shipGate.blockers.length === 0 ? "PASS" : "FAIL",
      authorCheck: authorFindings.length === 0 ? "PASS" : "FAIL",
      intraBook: intraFindings.some((f) => f.severity === "blocker") ? "FAIL" : "PASS",
      bookGate: bookGateStatus,
      sweep: "MISSING",
      manualKeyJudge: "MISSING",
      barRead: "MISSING",
      confirmRead: "MISSING",
      repairLedger: needsQcRerun ? "NEEDS_QC_RERUN" : openSerious ? "OPEN_FINDINGS" : "NO_OPEN_BLOCKERS",
      majors: majorStatus.status,
    };

    if (sweepRecord?.roundId === roundId) {
      if (sweepRecord.contentHashes?.[String(ch.number)] !== contentHash) checks.sweep = "STALE";
      else checks.sweep = sweepRecord.verdict === "PASS" ? "PASS" : "FAIL";
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
        barGate = computeVerdict(ch.chapterId, injectedBarAxes(bar, keyStatus), true).gate;
      }
    }
    checks.barRead = barGate;

    if (confirm) {
      if (confirm.chapterId !== ch.chapterId || confirm.contentHash !== contentHash) checks.confirmRead = "STALE";
      else checks.confirmRead = confirm.decision;
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
      checks.majors === "PASS";
    const confirmMissingForCandidate = publishableCandidate && (checks.confirmRead === "MISSING" || checks.confirmRead === "STALE");
    const sameReviewerConfirm = publishableCandidate && bar && confirm && bar.reviewer === confirm.reviewer && confirm.decision === "PUBLISHABLE";
    const unactionableBar = barGate === "YELLOW" && barHasUnactionableSubfloor(bar);
    const unactionableConfirm = publishableCandidate && confirmHasUnactionableDecision(confirm);
    // A fabricated sweep (verdict FAIL, all findings cite non-existent fields) is
    // excluded from the REVISE trigger so the chapter's REAL failures still drive
    // the verdict; if nothing else fails it routes to NEEDS_MORE_QC (re-run the
    // sweep), never PUBLISHABLE on an invalid sweep.
    const unactionableSweep = checks.sweep === "FAIL" && sweepAllFabricated;
    const sweepBlocks = checks.sweep !== "PASS" && !unactionableSweep;

    let finalVerdict: EvidenceChapterDecision["finalVerdict"] = "NEEDS_MORE_QC";
    let reason = "";
    if (missingRequired) {
      reason = "required QC artifact is missing or stale";
    } else if (confirmMissingForCandidate) {
      reason = "publishable candidate is missing a fresh confirm read";
    } else if (sameReviewerConfirm) {
      reason = "confirm reviewer must differ from bar reviewer";
    } else if (unactionableBar) {
      reason = "bar read has a sub-0.6 axis without a cited hit";
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
      checks.majors !== "PASS"
    ) {
      finalVerdict = "REVISE";
      reason = checks.majors !== "PASS"
        ? "one or more current major findings are unresolved or not round-backed"
        : publishableCandidate && checks.confirmRead === "REVISE" ? confirm?.reason ?? "confirm read requires revision" : "one or more gates, reads, or repair-ledger checks require revision";
    } else if (unactionableSweep) {
      // Nothing real failed, but the sweep verdict was non-pass on fabricated
      // findings — don't publish on an invalid sweep; ask for a fresh one.
      reason = "sweep returned a non-pass verdict but its finding(s) cite a chapter field that does not exist — re-run the sweep";
    } else {
      const block = currentNegativeAttestationBlocksPublishable(bookId, ch);
      if (block) {
        reason = block;
      } else {
        finalVerdict = "PUBLISHABLE";
        reason = confirm?.reason ?? "all required no-api QC evidence is fresh and publishable";
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
      bar,
      confirm,
      confirmAccepted: publishableCandidate,
    });
  }

  const finalizerFindings = decisions.flatMap((decision) => {
    const raw = rawByChapter.get(decision.chapterNumber);
    return raw ? findingsFromEvidenceDecision(decision, raw) : [];
  });
  if (!options.dryRun) appendFindings({
    bookId,
    roundId,
    role: "finalizer",
    submissionFile: "evidence-matrix.json",
    findings: finalizerFindings,
  });

  for (const decision of decisions) {
    if ((decision.finalVerdict === "REVISE" || decision.finalVerdict === "CORRUPTION") && activeLedgerFindingsForDecision(bookId, roundId, decision.chapterNumber).length === 0) {
      decision.finalVerdict = "NEEDS_MORE_QC";
      decision.reason = "non-publishable decision lacked actionable repair evidence";
    }
  }

  const matrixPath = evidenceMatrixPath(bookId, roundId);
  if (!options.dryRun) mkdirSync(dirname(matrixPath), { recursive: true });
  if (!options.dryRun) writeFileSync(matrixPath, JSON.stringify({
    schemaVersion: "qc-evidence-matrix-v1",
    bookId,
    roundId,
    generatedAt: new Date().toISOString(),
    chapters: decisions,
    errors,
  }, null, 2), "utf8");

  const writtenBriefPath = options.dryRun ? briefPath : writeRepairBrief(bookId, roundId);

  if (options.attest !== false && !options.dryRun) {
    const chapterByNumber = new Map(chapters.map((ch) => [ch.number, ch]));
    for (const decision of decisions) {
      if (decision.finalVerdict === "NEEDS_MORE_QC") continue;
      const ch = chapterByNumber.get(decision.chapterNumber);
      if (!ch) continue;
      const verdict: QcVerdict = decision.finalVerdict;
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
  if (!options.dryRun) writeFileSync(qcSummaryPath(bookId, roundId), JSON.stringify({
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
  }, null, 2) + "\n", "utf8");
  return result;
}
