import type { ChapterBlueprintV1, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { BookContentReader, CandidateSnapshot } from "../books/candidateTypes.js";
import { sourcePacketHash } from "../compiler/sourcePacket.js";
import { validateBlueprint } from "../compiler/blueprintGate.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { validateSourceUsePlan } from "../contracts/sourceUsePlan.js";
import type { ModelTaskContext, Result } from "../contracts/v4Core.js";
import { runBookGateFromCandidate } from "../critics/bookGate.js";
import { BOOK_PATTERN_AUDIT_LOGICAL_PATH } from "../critics/bookPatternAudit.js";
import { runChapterGateCompositeFromCandidate } from "../critics/chapterGateComposite.js";
import { isQcBlockingMajor } from "../critics/majorPolicy.js";
import { judgeQuizKeys, makeLiveAskModel } from "../critics/semantic/quizKeyJudge.js";
import type { QcEvaluation, QcIssue } from "../qc/qcTypes.js";
import type { CanonicalReviewResult } from "../review/reviewTypes.js";
import { evaluateSourceV2Integrity } from "../source/sourceIntegrity.js";
import type { ChapterV21 } from "../types.js";
import type { ModelTaskRunner } from "./modelTaskRunner.js";

/** Max model attempts per quiz-key-judge question (1 retry). Shared with
 *  freshQcRunDefinition's attempt capacity so a retry can never exhaust the
 *  judge run's admission budget. */
export const QUIZ_JUDGE_MAX_ATTEMPTS = 2;

export interface CandidateQcRequest {
  readonly candidate: CandidateSnapshot;
  readonly canonicalReview: CanonicalReviewResult;
  readonly roundId: string;
  /** Model-task context for the fresh-qc quiz-key judge. Required (alongside an
   *  injected runner) for the LLM answer-key judge to run; absent → judge skipped. */
  readonly taskContext?: ModelTaskContext;
}

export interface CandidateQcOptions {
  /** Injected model-task runner for the fresh-qc quiz-key judge (role "qc").
   *  Absent → the LLM answer-key judge does not run (deterministic gates only). */
  readonly runner?: ModelTaskRunner;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function identity(candidate: CandidateSnapshot) {
  return {
    candidateId: candidate.manifest.candidateId,
    manifestDigest: candidate.manifest.manifestDigest,
  };
}

function sameIdentity(left: { candidateId: string; manifestDigest: string }, right: { candidateId: string; manifestDigest: string }): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function location(chapterNumber: number, path?: string): string {
  return `ch${String(chapterNumber).padStart(2, "0")}${path ?? ""}`;
}

function issue(code: string, severity: QcIssue["severity"], message: string, path?: string): QcIssue {
  return { code, severity, message, ...(path === undefined ? {} : { location: path }) };
}

function parseJson(snapshot: CandidateSnapshot, logicalPath: string): Result<unknown> {
  const matches = snapshot.files.filter((file) => file.logicalPath === logicalPath);
  if (matches.length !== 1) return failed("CANDIDATE_QC_INPUT_MISSING", `expected one ${logicalPath}, found ${matches.length}`);
  if (matches[0].mediaType !== "application/json") return failed("CANDIDATE_QC_INPUT_INVALID", `${logicalPath} must use application/json`);
  try {
    return { ok: true, value: JSON.parse(Buffer.from(matches[0].bytes).toString("utf8")) as unknown };
  } catch {
    return failed("CANDIDATE_QC_INPUT_INVALID", `${logicalPath} is malformed JSON`);
  }
}

function chapterSet(snapshot: CandidateSnapshot): Result<ReadonlyArray<Readonly<{ chapter: ChapterV21; logicalPath: string }>>> {
  const parsed: Array<{ chapter: ChapterV21; logicalPath: string }> = [];
  for (const file of snapshot.files.filter((entry) => entry.kind === "CHAPTER")) {
    const value = parseJson(snapshot, file.logicalPath);
    if (!value.ok) return value;
    const chapter = value.value as Partial<ChapterV21> | null;
    if (!chapter || !Number.isInteger(chapter.number) || (chapter.number as number) < 1 || typeof chapter.chapterId !== "string") {
      return failed("CANDIDATE_QC_CHAPTER_INVALID", `${file.logicalPath} lacks valid chapterId/number`);
    }
    parsed.push({ chapter: chapter as ChapterV21, logicalPath: file.logicalPath });
  }
  parsed.sort((left, right) => left.chapter.number - right.chapter.number || left.logicalPath.localeCompare(right.logicalPath));
  if (parsed.length === 0) return failed("CANDIDATE_QC_CHAPTER_INVALID", "candidate has no CHAPTER files");
  for (let index = 0; index < parsed.length; index += 1) {
    if (parsed[index].chapter.number !== index + 1) {
      return failed("CANDIDATE_QC_CHAPTER_ORDER_INVALID", "CHAPTER files must form one contiguous 1-based chapter set");
    }
  }
  return { ok: true, value: parsed };
}

function compilerPath(chapterNumber: number, leaf: string): string {
  return `compiler/ch${String(chapterNumber).padStart(2, "0")}/${leaf}`;
}

function inputBlocker(error: { code: string; message: string }, path?: string): QcIssue {
  return issue(error.code, "BLOCKER", error.message, path);
}

function mappedSeverity(catalogId: string, severity: "blocker" | "major" | "minor"): QcIssue["severity"] {
  return severity === "blocker" || (severity === "major" && isQcBlockingMajor(catalogId)) ? "BLOCKER" : "WARN";
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Runtime guard deliberately precedes validateSourceUsePlan: that contract validator
 * assumes several fields already have their declared runtime types. */
function strictSourceUsePlan(value: unknown): Result<SourceUsePlanV1> {
  if (!record(value) || !exactKeys(value, ["schema", "planVersion", "bookId", "chapterNumber", "sourcePacketSha256", "compilerVersion", "units"])) {
    return failed("SOURCE_USE_PLAN_INVALID", "source-use plan must be an exact contract object");
  }
  if (
    value.schema !== "source-use-plan-v1" || value.planVersion !== 1 || !nonempty(value.bookId) ||
    !Number.isInteger(value.chapterNumber) || (value.chapterNumber as number) < 1 ||
    !nonempty(value.sourcePacketSha256) || !nonempty(value.compilerVersion) || !Array.isArray(value.units)
  ) {
    return failed("SOURCE_USE_PLAN_INVALID", "source-use plan top-level field types are invalid");
  }
  for (let index = 0; index < value.units.length; index += 1) {
    const unit = value.units[index];
    if (!record(unit)) return failed("SOURCE_USE_PLAN_INVALID", `source-use plan unit ${index} must be an object`);
    const fields = ["unitId", "origin", "form", "claimStrength", "anchorIds", "allowedDetailTypes", "forbiddenDetailTypes", "detailSufficiency", "framingRequired"];
    if (unit.caseId !== undefined) fields.push("caseId");
    if (!exactKeys(unit, fields)) return failed("SOURCE_USE_PLAN_INVALID", `source-use plan unit ${index} has unknown or missing fields`);
    if (
      !nonempty(unit.unitId) || !nonempty(unit.origin) || !nonempty(unit.form) || !nonempty(unit.claimStrength) ||
      !Array.isArray(unit.anchorIds) || !unit.anchorIds.every(nonempty) ||
      !Array.isArray(unit.allowedDetailTypes) || !unit.allowedDetailTypes.every(nonempty) ||
      !Array.isArray(unit.forbiddenDetailTypes) || !unit.forbiddenDetailTypes.every(nonempty) ||
      !nonempty(unit.detailSufficiency) || typeof unit.framingRequired !== "boolean" ||
      (unit.caseId !== undefined && !nonempty(unit.caseId))
    ) {
      return failed("SOURCE_USE_PLAN_INVALID", `source-use plan unit ${index} field types are invalid`);
    }
  }
  return { ok: true, value: value as unknown as SourceUsePlanV1 };
}

export class CandidateQcEvaluator {
  readonly #reader: BookContentReader;
  readonly #runner: ModelTaskRunner | undefined;

  constructor(reader: BookContentReader, options?: CandidateQcOptions) {
    this.#reader = reader;
    this.#runner = options?.runner;
  }

  async run(request: CandidateQcRequest): Promise<Result<QcEvaluation>> {
    if (!request.roundId.trim()) return failed("CANDIDATE_QC_ROUND_INVALID", "roundId must be nonempty");
    if (request.candidate.currentRevision !== undefined) {
      return failed("CANDIDATE_QC_SELECTOR_INVALID", "QC requires explicit immutable candidate, not current pointer snapshot");
    }
    const requestedIdentity = identity(request.candidate);
    if (
      request.canonicalReview.schemaVersion !== "1" ||
      request.canonicalReview.outcome !== "PASS" ||
      !sameIdentity(request.canonicalReview.candidate, requestedIdentity)
    ) {
      return failed("CANDIDATE_QC_CANONICAL_PASS_REQUIRED", "exact candidate-bound canonical PASS is required");
    }

    const reopened = await this.#reader.open({
      bookId: request.candidate.manifest.bookId,
      selector: { kind: "CANDIDATE", candidateId: request.candidate.manifest.candidateId },
    });
    if (!reopened.ok) return reopened;
    const candidate = reopened.value;
    if (
      candidate.currentRevision !== undefined ||
      candidate.manifest.bookId !== request.candidate.manifest.bookId ||
      !sameIdentity(identity(candidate), requestedIdentity)
    ) {
      return failed("CANDIDATE_QC_CANDIDATE_MISMATCH", "reopened immutable candidate identity differs");
    }

    const chapters = chapterSet(candidate);
    if (!chapters.ok) return chapters;
    const qcIssues: QcIssue[] = request.canonicalReview.issues.map((reviewIssue) => issue(
      `REVIEW.${reviewIssue.code}`,
      reviewIssue.severity === "BLOCKER" ? "BLOCKER" : "WARN",
      reviewIssue.message,
      reviewIssue.location,
    ));
    const validInputs = new Set<number>();

    for (const entry of chapters.value) {
      const number = entry.chapter.number;
      const blueprintPath = compilerPath(number, "blueprint.json");
      const sourcePacketPath = compilerPath(number, "source-packet.json");
      const sourceUsePlanPath = compilerPath(number, "source-use-plan.json");
      const blueprintRaw = parseJson(candidate, blueprintPath);
      const packetRaw = parseJson(candidate, sourcePacketPath);
      const planRaw = parseJson(candidate, sourceUsePlanPath);
      for (const [result, path] of [[blueprintRaw, blueprintPath], [packetRaw, sourcePacketPath], [planRaw, sourceUsePlanPath]] as const) {
        if (!result.ok) qcIssues.push(inputBlocker(result.error, path));
      }
      if (!blueprintRaw.ok || !packetRaw.ok || !planRaw.ok) continue;

      const blueprint = blueprintRaw.value as ChapterBlueprintV1;
      const packet = packetRaw.value as SourcePacketV1;
      const strictPlan = strictSourceUsePlan(planRaw.value);
      if (!strictPlan.ok) {
        qcIssues.push(inputBlocker(strictPlan.error, sourceUsePlanPath));
        continue;
      }
      const plan = strictPlan.value;
      let blueprintFindings: ReturnType<typeof validateBlueprint>;
      try {
        blueprintFindings = validateBlueprint(blueprint);
      } catch (error) {
        qcIssues.push(issue("CANDIDATE_QC_BLUEPRINT_INVALID", "BLOCKER", `blueprint validator rejected runtime shape: ${(error as Error).message}`, blueprintPath));
        continue;
      }
      for (const finding of blueprintFindings) {
        qcIssues.push(issue(
          finding.checkId,
          finding.severity === "blocker" ? "BLOCKER" : "WARN",
          finding.message,
          location(number, finding.path),
        ));
      }
      if (blueprint.bookId !== candidate.manifest.bookId || blueprint.chapterNumber !== number || blueprint.chapterId !== entry.chapter.chapterId) {
        qcIssues.push(issue("CANDIDATE_QC_BLUEPRINT_MISMATCH", "BLOCKER", "blueprint identity differs from candidate chapter", blueprintPath));
      }
      if (packet.bookId !== candidate.manifest.bookId || packet.chapterNumber !== number || packet.chapterId !== entry.chapter.chapterId) {
        qcIssues.push(issue("CANDIDATE_QC_SOURCE_PACKET_MISMATCH", "BLOCKER", "source packet identity differs from candidate chapter", sourcePacketPath));
      }
      let packetHash: string;
      try {
        packetHash = sourcePacketHash(packet);
      } catch (error) {
        qcIssues.push(issue("CANDIDATE_QC_SOURCE_PACKET_INVALID", "BLOCKER", `source packet cannot be hashed: ${(error as Error).message}`, sourcePacketPath));
        continue;
      }
      if (blueprint.sourcePacketPath !== sourcePacketPath || blueprint.sourcePacketHash !== packetHash) {
        qcIssues.push(issue("CANDIDATE_QC_BLUEPRINT_SOURCE_MISMATCH", "BLOCKER", "blueprint is not bound to exact candidate source packet", blueprintPath));
      }
      let planErrors: string[];
      try {
        planErrors = validateSourceUsePlan(plan);
      } catch (error) {
        qcIssues.push(issue("SOURCE_USE_PLAN_INVALID", "BLOCKER", `source-use plan validator rejected runtime shape: ${(error as Error).message}`, sourceUsePlanPath));
        continue;
      }
      for (const message of planErrors) qcIssues.push(issue("SOURCE_USE_PLAN_INVALID", "BLOCKER", message, sourceUsePlanPath));
      if (plan.bookId !== candidate.manifest.bookId || plan.chapterNumber !== number || plan.sourcePacketSha256 !== packetHash) {
        qcIssues.push(issue("CANDIDATE_QC_SOURCE_USE_MISMATCH", "BLOCKER", "source-use plan is not bound to exact candidate source packet", sourceUsePlanPath));
      }
      if (typeof packet.sourceSidecarPath !== "string" || packet.sourceSidecarPath.length === 0) {
        qcIssues.push(issue("CANDIDATE_QC_SOURCE_SIDECAR_MISSING", "BLOCKER", "source packet lacks candidate source-v2 sidecar path", sourcePacketPath));
        continue;
      }
      const sidecarRaw = parseJson(candidate, packet.sourceSidecarPath);
      if (!sidecarRaw.ok) {
        qcIssues.push(inputBlocker(sidecarRaw.error, packet.sourceSidecarPath));
        continue;
      }
      let sourceIntegrity: ReturnType<typeof evaluateSourceV2Integrity>;
      try {
        sourceIntegrity = evaluateSourceV2Integrity(sidecarRaw.value, {
          chapterNumber: number,
          chapterTitle: packet.chapterTitle,
          rawText: Buffer.from(candidate.files.find((file) => file.logicalPath === packet.sourceSidecarPath)!.bytes).toString("utf8"),
        });
      } catch (error) {
        qcIssues.push(issue("CANDIDATE_QC_SOURCE_V2_INVALID", "BLOCKER", `source-v2 integrity validator threw: ${(error as Error).message}`, packet.sourceSidecarPath));
        continue;
      }
      for (const finding of sourceIntegrity.findings) {
        qcIssues.push(issue(
          finding.checkId,
          finding.severity === "blocker" ? "BLOCKER" : "WARN",
          finding.message,
          packet.sourceSidecarPath,
        ));
      }
      if (!sourceIntegrity.passed) continue;
      if (!blueprintFindings.some((finding) => finding.severity === "blocker") && planErrors.length === 0) validInputs.add(number);
    }

    const attemptState: Record<string, never> = {};
    for (const entry of chapters.value) {
      if (!validInputs.has(entry.chapter.number)) continue;
      const number = entry.chapter.number;
      const packet = parseJson(candidate, compilerPath(number, "source-packet.json"));
      if (!packet.ok) continue;
      const sourceSidecarPath = (packet.value as SourcePacketV1).sourceSidecarPath as string;
      try {
        const report = await runChapterGateCompositeFromCandidate(this.#reader, {
          bookId: candidate.manifest.bookId,
          candidateId: candidate.manifest.candidateId,
          manifestDigest: candidate.manifest.manifestDigest,
          chapterLogicalPath: entry.logicalPath,
          siblingLogicalPaths: chapters.value.filter((other) => other.chapter.number !== number).map((other) => other.logicalPath),
          sourceSidecarLogicalPath: sourceSidecarPath,
          blueprintLogicalPath: compilerPath(number, "blueprint.json"),
          sourceUsePlanLogicalPath: compilerPath(number, "source-use-plan.json"),
          siblingContextPath: entry.logicalPath,
          attemptKey: `${candidate.manifest.candidateId}:ch${String(number).padStart(2, "0")}`,
          gateAttemptState: attemptState,
          persistGateAttemptState: () => {},
        });
        for (const finding of report.findings) {
          qcIssues.push(issue(
            finding.catalogId,
            mappedSeverity(finding.catalogId, finding.severity),
            finding.message,
            location(number, finding.unit ? `/${finding.unit}` : undefined),
          ));
        }
      } catch (error) {
        qcIssues.push(issue("CANDIDATE_QC_CHAPTER_GATE_ERROR", "BLOCKER", (error as Error).message, entry.logicalPath));
      }
    }

    try {
      const sourceSidecarLogicalPaths = chapters.value.map((entry) => {
        const packet = parseJson(candidate, compilerPath(entry.chapter.number, "source-packet.json"));
        if (!packet.ok) throw new Error(`${packet.error.code}: ${packet.error.message}`);
        const path = (packet.value as SourcePacketV1).sourceSidecarPath;
        if (typeof path !== "string" || path.length === 0) {
          throw new Error(`CANDIDATE_QC_SOURCE_SIDECAR_MISSING: ch${String(entry.chapter.number).padStart(2, "0")}`);
        }
        return path;
      });
      const book = await runBookGateFromCandidate(this.#reader, {
        bookId: candidate.manifest.bookId,
        candidateId: candidate.manifest.candidateId,
        manifestDigest: candidate.manifest.manifestDigest,
        chapterLogicalPaths: chapters.value.map((entry) => entry.logicalPath),
        sourceSidecarLogicalPaths,
        patternAuditLogicalPath: BOOK_PATTERN_AUDIT_LOGICAL_PATH,
      });
      for (const finding of book.findings) {
        qcIssues.push(issue(
          finding.catalogId,
          mappedSeverity(finding.catalogId, finding.severity),
          finding.message,
          finding.path ?? (finding.chapters?.length ? finding.chapters.map((number) => location(number)).join(",") : undefined),
        ));
      }
    } catch (error) {
      qcIssues.push(issue("CANDIDATE_QC_BOOK_GATE_ERROR", "BLOCKER", (error as Error).message, BOOK_PATTERN_AUDIT_LOGICAL_PATH));
    }

    // LLM answer-key judge (fresh-qc). The deterministic gates cannot tell
    // whether a quiz's correctIndex points at the RIGHT choice; this restores
    // the model-backed judge on the V4 seam. Fail-closed: a confident wrong-key
    // verdict is a BLOCKER, and a judge execution failure is a BLOCKER too (an
    // uncertain judge never silently passes). Runs only when both a runner and a
    // task context are injected; otherwise the deterministic gates stand alone.
    if (this.#runner !== undefined && request.taskContext !== undefined) {
      const runner = this.#runner;
      const base = request.taskContext;
      // Each question is one model call = one run-state attempt, so every call
      // needs a globally-unique attemptId/operationId — the gateway rejects a
      // repeated attemptId within a run. The ordinal is monotonic across every
      // chapter so the caller can size the fresh-qc run's attempt capacity to
      // the candidate's total quiz-question count.
      let judgeOrdinal = 0;
      for (const entry of chapters.value) {
        const number = entry.chapter.number;
        try {
          const report = await judgeQuizKeys(entry.chapter, {
            ask: async (args) => {
              judgeOrdinal += 1;
              const suffix = `ch${String(number).padStart(2, "0")}-q${String(judgeOrdinal).padStart(3, "0")}`;
              // Bounded per-question retry with a DISTINCT attempt id per try —
              // the gateway rejects a reused attemptId within a run, and the
              // run's capacity is sized questionCount * QUIZ_JUDGE_MAX_ATTEMPTS
              // to host it. Single-shot judging meant one transient timeout or
              // malformed judgment became a durable blocker no repair could
              // scope and no resume could re-run.
              let lastError: unknown;
              for (let attempt = 1; attempt <= QUIZ_JUDGE_MAX_ATTEMPTS; attempt += 1) {
                // An aborted signal fails every future call identically (the
                // runner returns CANCELLED pre-admission) — burning the retry
                // budget against it is pure waste, and the caller must see the
                // cancellation, not a manufactured content verdict.
                if (base.signal.aborted) {
                  throw new Error("QUIZ_KEY_MODEL_CANCELLED:judge task signal aborted");
                }
                const judgeCtx: ModelTaskContext = {
                  ...base,
                  attemptId: `${base.attemptId}-quizjudge-${suffix}-a${attempt}`,
                  operationId: `quiz-key-judge-${suffix}-a${attempt}`,
                };
                try {
                  return await makeLiveAskModel({ execution: { runner, context: judgeCtx } })(args);
                } catch (error) {
                  lastError = error;
                  if (error instanceof Error && error.message.startsWith("QUIZ_KEY_MODEL_CANCELLED")) throw error;
                }
              }
              throw lastError;
            },
          });
          for (const verdict of report.flagged) {
            qcIssues.push(issue(
              "QC1.wrong_quiz_key",
              "BLOCKER",
              `quiz answer-key judge flagged ${verdict.questionId}: stored correctIndex=${verdict.storedIndex} but the model derived index ${verdict.modelIndex} (${verdict.reason})`,
              location(number, `/quiz/${verdict.questionId}`),
            ));
          }
          // Medium-confidence disagreements are never auto-blocked (quizKeyJudge's
          // contract), but the human-review escalation must not be silently lost:
          // surface them as WARN so operators can see medium-confidence key doubts.
          for (const verdict of report.review) {
            qcIssues.push(issue(
              "QC1.quiz_key_review",
              "WARN",
              `quiz answer-key judge flagged ${verdict.questionId} for human review: stored correctIndex=${verdict.storedIndex}, model derived index ${verdict.modelIndex} at medium confidence (${verdict.reason})`,
              location(number, `/quiz/${verdict.questionId}`),
            ));
          }
        } catch (error) {
          // THROWS ARE INFRASTRUCTURE, REPORT VERDICTS ARE CONTENT. A judge that
          // could not run (cancelled signal, retry-exhausted transients, expired
          // CLI credentials) has said nothing about the quiz keys — committing
          // its failure as a FAIL round manufactured a content verdict the
          // repair path rightly refuses (CANDIDATE_QC_-prefixed blockers are
          // compiler-owned), permanently wedging a review-passed candidate. The
          // evaluation errors instead: no round is committed, and the caller's
          // successor machinery re-judges on resume with fresh attempt ids.
          const message = (error as Error).message;
          const cancelled = message.startsWith("QUIZ_KEY_MODEL_CANCELLED");
          return failed(
            cancelled ? "CANDIDATE_QC_JUDGE_CANCELLED" : "CANDIDATE_QC_JUDGE_UNAVAILABLE",
            `quiz answer-key judge could not complete ch${String(number).padStart(2, "0")}: ${message}`,
          );
        }
      }
    }

    const hasBlocker = qcIssues.some((entry) => entry.severity === "BLOCKER");
    return {
      ok: true,
      value: {
        roundId: request.roundId,
        candidate: requestedIdentity,
        reviewId: request.canonicalReview.reviewId,
        outcome: hasBlocker ? "FAIL" : "PASS",
        issues: qcIssues,
      },
    };
  }
}
