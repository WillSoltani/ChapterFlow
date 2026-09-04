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
import type { GateFinding } from "../critics/finalGate.js";
import { isAdvisoryMajor, isQcBlockingMajor } from "../critics/majorPolicy.js";
import {
  judgeQuizKeys,
  makeLiveAskModel,
  type SourceContextProvenance,
} from "../critics/semantic/quizKeyJudge.js";
import {
  SOURCE_FIDELITY_EXPLANATION_CODE,
  classifySourceFidelityFindings,
  judgeChapterSourceFidelity,
  makeLiveSourceFidelityAsk,
  ruleCitedClaim,
  sourceFidelityCallCount,
  sourceFidelityVetoDisagreement,
} from "../critics/semantic/sourceFidelityJudge.js";
import type { QcEvaluation, QcIssue } from "../qc/qcTypes.js";
import { isReviewIssueCode } from "../review/readerPanelIssueCodes.js";
import { PANEL_QUIZ_DERIVATION_SPLIT_CODE } from "../review/panelQuizAdjudication.js";
import type { CanonicalReviewResult, ReviewIssue } from "../review/reviewTypes.js";
import {
  resolveCandidateChapterSource,
  type ResolvedCandidateSource,
} from "../source/candidateSourceContext.js";
import { spanExcerptForPrompt } from "../source/chapterMap.js";
import { evaluateSourceV2Integrity } from "../source/sourceIntegrity.js";
import type { ChapterV21 } from "../types.js";
import type { ModelTaskRunner } from "./modelTaskRunner.js";

/** Max model attempts per quiz-key-judge question (1 retry). Shared with
 *  freshQcRunDefinition's attempt capacity so a retry can never exhaust the
 *  judge run's admission budget. */
export const QUIZ_JUDGE_MAX_ATTEMPTS = 2;

/** Max model attempts per source-fidelity CHUNK (1 retry), for the same reason
 *  and sized into the same run capacity: a single transient blip must not become
 *  a durable blocker no repair can scope. */
export const SOURCE_FIDELITY_MAX_ATTEMPTS = 2;

/**
 * Most reader escalations handed to one chapter's fidelity judge, and the
 * longest each may be.
 *
 * The live shipping round carried 36 escalations across four chapters (19
 * origin_ambiguous_to_reader + 10 possible_attribution_issue + 7
 * possible_real_world_claim), so twelve per chapter is above what a real panel
 * produces; the bound exists so a degenerate panel cannot grow the judge prompt
 * without limit. Every escalation still reaches the QC round as its own WARN -
 * this bounds the HINT LIST, not the record.
 */
export const MAX_FIDELITY_CLAIM_HINTS = 12;
export const MAX_FIDELITY_CLAIM_HINT_CHARS = 400;

/** The round's marker for "the model-backed judges did not run" — the QC round's
 *  equivalent of publishableBar's `ran: false`. It is on the round precisely so
 *  the claim that a chapter WAS checked against the book is provable from the
 *  record rather than from how the evaluator happened to be composed. */
export const SOURCE_FIDELITY_NOT_RUN_CODE = "CANDIDATE_QC_SOURCE_FIDELITY_NOT_RUN";

const READER_ESCALATION_PREFIX = "READER.ESCALATION.";

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

/**
 * Collapse a chapter's repeated ADVISORY-major findings into one entry per
 * catalog id, carrying the occurrence count and the units it fired on.
 *
 * WHY. An advisory major gates nothing by construction (majorPolicy:
 * ADVISORY_MAJOR_PREFIXES — the FP-prone / reference-firing set), yet it is
 * emitted once per unit. The live SHIPPING round repair-r7-qc-88b631ed carried
 * 235 issues of which 101 were E7.long_sentence and 7 E7.dense_headline: 46% of
 * the round was one non-gating style signal, and it crowded the repair brief's
 * 8000-character advisory budget out of the findings that could be acted on.
 *
 * Blocking findings and minors are untouched, and no advisory is discarded: the
 * class, its count and its units all survive on the one entry. The collapsed
 * entry drops its `unit` so the QC issue locates to the chapter it describes.
 */
export function aggregateAdvisoryMajorFindings(findings: readonly GateFinding[]): GateFinding[] {
  const advisory = (finding: GateFinding): boolean => finding.severity === "major" && isAdvisoryMajor(finding.catalogId);
  const counts = new Map<string, GateFinding[]>();
  for (const finding of findings) {
    if (!advisory(finding)) continue;
    const group = counts.get(finding.catalogId) ?? [];
    group.push(finding);
    counts.set(finding.catalogId, group);
  }
  const emitted = new Set<string>();
  const out: GateFinding[] = [];
  for (const finding of findings) {
    if (!advisory(finding)) { out.push(finding); continue; }
    const group = counts.get(finding.catalogId)!;
    if (group.length === 1) { out.push(finding); continue; }
    if (emitted.has(finding.catalogId)) continue;
    emitted.add(finding.catalogId);
    const units: string[] = [];
    for (const member of group) if (member.unit && !units.includes(member.unit)) units.push(member.unit);
    out.push({
      ...finding,
      unit: "",
      message: `${group.length} occurrences in this chapter (advisory: this class does not gate). Units: ${units.join(", ")}. First: ${finding.message}`,
    });
  }
  return out;
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

/**
 * The reader escalations for one chapter, as claim hints for the fidelity judge
 * (R-148).
 *
 * An escalation is a seat saying "this reads as factual and I cannot check it" -
 * exactly the question this judge exists to settle, and until now the one
 * finding class with no consumer at all: `semanticPanelReviewEvaluator` emitted
 * every one as a WARN and the repair brief filed it beside a pacing nit. The
 * WARNs stay on the record; this makes them an INPUT.
 */
export function fidelityClaimHints(issues: readonly ReviewIssue[], chapterNumber: number): readonly string[] {
  const prefix = `ch${String(chapterNumber).padStart(2, "0")}/`;
  const hints: string[] = [];
  for (const issue of issues) {
    const bare = issue.code.startsWith("REVIEW.") ? issue.code.slice("REVIEW.".length) : issue.code;
    if (!bare.startsWith(READER_ESCALATION_PREFIX)) continue;
    if (!(issue.location ?? "").startsWith(prefix)) continue;
    const category = bare.slice(READER_ESCALATION_PREFIX.length);
    const line = `${category} (${issue.location}): ${issue.message}`;
    hints.push(line.length <= MAX_FIDELITY_CLAIM_HINT_CHARS ? line : `${line.slice(0, MAX_FIDELITY_CLAIM_HINT_CHARS - 1)}...`);
    if (hints.length === MAX_FIDELITY_CLAIM_HINTS) break;
  }
  return hints;
}

/**
 * Question ids the blind reader panel derived differently from the stored key at
 * a strength below its own blocker (R-131/R-135).
 *
 * Location shape is `chNN/quiz/<questionId>`, minted by
 * `semanticPanelReviewEvaluator` from `adjudicatePanelQuizDerivations`.
 */
export function panelFlaggedQuestionIds(issues: readonly ReviewIssue[], chapterNumber: number): ReadonlySet<string> {
  const prefix = `ch${String(chapterNumber).padStart(2, "0")}/quiz/`;
  const ids = new Set<string>();
  for (const issue of issues) {
    if (!isReviewIssueCode(issue.code, PANEL_QUIZ_DERIVATION_SPLIT_CODE)) continue;
    const location = issue.location ?? "";
    if (!location.startsWith(prefix)) continue;
    const id = location.slice(prefix.length);
    if (id.length > 0) ids.add(id);
  }
  return ids;
}

/** What the answer-key judge is handed, and the TRUTH about it. */
export type QuizJudgeSourceContext = {
  readonly text: string;
  readonly provenance: SourceContextProvenance;
  /** True when the span exceeded MAX_SPAN_PROMPT_CHARS and the judge sees
   *  sampled windows rather than the whole span. */
  readonly excerpted: boolean;
  /** Characters of the span the judge does NOT see (0 when it sees all of it). */
  readonly omittedChars: number;
};

/**
 * The source context the ANSWER-KEY judge receives (R-078/R-134).
 *
 * `source-text`: the chapter's own span, bounded by the SAME deterministic
 * excerpt the research prompt uses, so a resumed run re-issues identical bytes.
 * `model-memory`: the sidecar's recalled claims, and the judge's prompt header
 * says so - the pre-existing header called whatever it was given "ground
 * truth", which on a model-memory book is a false statement in a judge prompt.
 *
 * ROUND 2: the excerpt's own report travels with the text. A span over
 * `MAX_SPAN_PROMPT_CHARS` reaches the prompt as `SPAN_EXCERPT_WINDOWS` sampled
 * windows separated by omission markers, so the header must not call it
 * verbatim and a finding of ABSENCE inside it must not be enforced. MEASURED on
 * the book this package was built for - the frozen Franklin the canary run read
 * (~/cf-canary/sources/the-autobiography-of-benjamin-franklin.txt, sha256
 * 7863cf09…, out of this repo and read-only): it normalizes to 378,231
 * characters, a quarter of it is a 94,557-character chapter span, and each such
 * span reaches this judge as 60,424 prompt characters with 34,557 (36.5%)
 * omitted. `quizKeyJudge`'s header carries the full measurement note, including
 * which artifact each figure came from and how to re-measure it. The caller can
 * hold both facts because it holds the whole span AND this excerpt of it.
 */
export function quizJudgeSourceContext(source: ResolvedCandidateSource): QuizJudgeSourceContext | undefined {
  if (source.context.provenance === "source-text") {
    const excerpt = spanExcerptForPrompt(source.context.spanText);
    if (excerpt.text.trim().length === 0) return undefined;
    return {
      text: excerpt.text,
      provenance: "source-text",
      excerpted: excerpt.excerpted,
      omittedChars: excerpt.omittedChars,
    };
  }
  const claims = source.context.recalledClaims;
  if (claims.length === 0) return undefined;
  return {
    text: claims.map((claim, index) => `[R${index + 1}] ${claim}`).join("\n"),
    provenance: "model-memory",
    excerpted: false,
    omittedChars: 0,
  };
}

/**
 * How many source-fidelity model calls this candidate costs, before retries.
 *
 * Derived from the candidate's own bytes exactly as the evaluator will derive
 * them, so the fresh-qc run's attempt capacity is sized to the work that will
 * actually be admitted. A chapter whose inputs cannot be read counts ONE: the
 * evaluator will not judge it (it already carries an input blocker), and
 * over-counting a slot is free while under-counting one wedges the run.
 */
export function countSourceFidelityCalls(candidate: CandidateSnapshot): number {
  let total = 0;
  for (const file of candidate.files) {
    if (file.kind !== "CHAPTER") continue;
    let number: number | null = null;
    try {
      const chapter = JSON.parse(Buffer.from(file.bytes).toString("utf8")) as { number?: unknown };
      if (Number.isInteger(chapter.number) && (chapter.number as number) >= 1) number = chapter.number as number;
    } catch {
      number = null;
    }
    if (number === null) { total += 1; continue; }
    const packet = parseJson(candidate, compilerPath(number, "source-packet.json"));
    const sidecarPath = packet.ok ? (packet.value as SourcePacketV1).sourceSidecarPath : undefined;
    const sidecar = typeof sidecarPath === "string" && sidecarPath.length > 0 ? parseJson(candidate, sidecarPath) : undefined;
    const resolved = resolveCandidateChapterSource({
      files: candidate.files,
      chapterNumber: number,
      sidecar: sidecar !== undefined && sidecar.ok ? sidecar.value : undefined,
    });
    total += resolved.ok ? sourceFidelityCallCount(resolved.value.context) : 1;
  }
  return Math.max(total, 1);
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
    // REVIEW SEVERITY IS PRESERVED, NOT FLATTENED (R-162). Every non-blocking
    // review issue used to arrive as WARN, so the review lane had no way to emit
    // a note it did not want acted on: the live INFO pass attestation
    // CONTENT_REVIEWED_NO_INJECTION reached the repair brief at the same severity
    // as a real pacing defect. A QC round can only represent WARN and BLOCKER, so
    // an INFO review issue does not enter it; it stays on the persisted review
    // record, which is the artifact that owns it.
    const qcIssues: QcIssue[] = request.canonicalReview.issues
      .filter((reviewIssue) => reviewIssue.severity !== "INFO")
      .map((reviewIssue) => issue(
        `REVIEW.${reviewIssue.code}`,
        reviewIssue.severity === "BLOCKER" ? "BLOCKER" : "WARN",
        reviewIssue.message,
        reviewIssue.location,
      ));
    const validInputs = new Set<number>();
    // Per-chapter source binding, resolved ONCE from the candidate's own bytes
    // (the frozen text + chapter map wave 1 copied in, or the honest
    // model-memory state). Populated only for chapters whose sidecar parsed, so
    // a chapter with a broken input never reaches a model call.
    const sources = new Map<number, ResolvedCandidateSource>();

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
      // WHAT THIS CHAPTER IS CHECKED AGAINST, decided here and once. A candidate
      // whose sidecar claims it was quoted from a text the candidate does not
      // carry, or whose chapter map is bound to different bytes, is a BLOCKER:
      // downgrading it to model-memory would turn every fidelity blocker into a
      // warning because a file went missing, which is the fail-open shape this
      // whole package exists to remove.
      const resolvedSource = resolveCandidateChapterSource({
        files: candidate.files,
        chapterNumber: number,
        sidecar: sidecarRaw.value,
      });
      if (!resolvedSource.ok) qcIssues.push(inputBlocker(resolvedSource.error, packet.sourceSidecarPath));
      else sources.set(number, resolvedSource.value);
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
      const number = entry.chapter.number;
      // AN UNGATED CHAPTER IS NAMED, NEVER SILENTLY SKIPPED (R-163). A chapter
      // whose compiler inputs fail cannot be content-gated, and dropping it here
      // made the round's finding set an honest description of only the chapters
      // that happened to compile: the excluded chapter carried its input blocker
      // and no content finding, which reads as "clean" to anyone counting.
      // Every path that leaves a chapter out of `validInputs` has already pushed
      // its own BLOCKER, so this states a consequence and never flips a round.
      if (!validInputs.has(number)) {
        qcIssues.push(issue(
          "CANDIDATE_QC_CHAPTER_NOT_GATED",
          "BLOCKER",
          `ch${String(number).padStart(2, "0")} compiler inputs are invalid, so no content gate ran for it: this round carries NO content findings for this chapter`,
          entry.logicalPath,
        ));
        continue;
      }
      const packet = parseJson(candidate, compilerPath(number, "source-packet.json"));
      if (!packet.ok) {
        qcIssues.push(issue(
          "CANDIDATE_QC_CHAPTER_NOT_GATED",
          "BLOCKER",
          `ch${String(number).padStart(2, "0")} source packet became unreadable before the chapter gate ran: ${packet.error.message}`,
          compilerPath(number, "source-packet.json"),
        ));
        continue;
      }
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
        for (const finding of aggregateAdvisoryMajorFindings(report.findings)) {
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

    // THE TWO MODEL-BACKED JUDGES OF FRESH QC.
    //
    //   SOURCE FIDELITY (R-077, R-136) asks whether what the chapter SAYS is
    //   true of the book it teaches. Nothing in the pipeline asked that: the
    //   strongest source-linked deterministic test is literal token presence
    //   against the sidecar, and the sidecar is the research model's own recall,
    //   so the gates enforced REPRODUCTION of that recall, true or false.
    //
    //   ANSWER KEY asks whether a quiz's correctIndex points at the RIGHT
    //   choice, which no deterministic gate can decide either.
    //
    // Both run only when a runner AND a task context are injected; otherwise the
    // deterministic gates stand alone. Both are fail-closed the same way: an
    // adverse VERDICT is a finding, and an execution FAILURE is an evaluation
    // ERROR — never a manufactured PASS and never a manufactured FAIL round.
    if (this.#runner !== undefined && request.taskContext !== undefined) {
      const runner = this.#runner;
      const base = request.taskContext;
      // Each question is one model call = one run-state attempt, so every call
      // needs a globally-unique attemptId/operationId — the gateway rejects a
      // repeated attemptId within a run. The ordinal is monotonic across every
      // chapter so the caller can size the fresh-qc run's attempt capacity to
      // the candidate's total quiz-question count.
      let judgeOrdinal = 0;
      // Every fidelity attempt id names the exact bytes it judged. The verdict
      // is already bound to the candidate by the round (`QcEvaluation.candidate`
      // carries candidateId + manifestDigest, and the reopened snapshot was
      // identity-checked above); stamping the digest into run-state makes the
      // binding visible in the admission log too, so an operator reading it can
      // see WHICH candidate a judge call belonged to without joining tables.
      const digestTag = candidate.manifest.manifestDigest.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
      for (const entry of chapters.value) {
        const number = entry.chapter.number;
        const chapterLabel = `ch${String(number).padStart(2, "0")}`;
        const source = sources.get(number);
        // Only a card carrying the BOOK'S OWN BYTES needs the long route. A
        // model-memory context is the sidecar's recalled claims — a few hundred
        // characters — so that judge keeps exactly the profile it always had.
        const carriesSpan = source !== undefined && source.context.provenance === "source-text";
        // Resolved ONCE: the answer-key judge's prompt and the SF4 severity rule
        // below must be talking about the same block of source, including how
        // much of the span it leaves out.
        const quizSource = source === undefined ? undefined : quizJudgeSourceContext(source);

        // ── SOURCE-FIDELITY JUDGE (R-077, R-136, R-148, R-150) ──────────────
        // Runs FIRST: it is the check that decides whether the chapter is true
        // of the book, and it is the one whose findings the repair brief needs
        // the source quote from. A chapter with no resolved source binding is
        // skipped here and already carries its own input BLOCKER.
        if (source !== undefined) {
          let fidelity;
          try {
            fidelity = await judgeChapterSourceFidelity({
              chapter: entry.chapter,
              source: source.context,
              claimHints: fidelityClaimHints(request.canonicalReview.issues, number),
              ask: async (fidelityRequest) => {
                const suffix = `${chapterLabel}-c${String(fidelityRequest.chunkIndex + 1).padStart(2, "0")}`;
                let lastError: unknown;
                for (let attempt = 1; attempt <= SOURCE_FIDELITY_MAX_ATTEMPTS; attempt += 1) {
                  if (base.signal.aborted) {
                    throw new Error("SOURCE_FIDELITY_MODEL_CANCELLED:judge task signal aborted");
                  }
                  const fidelityCtx: ModelTaskContext = {
                    ...base,
                    attemptId: `${base.attemptId}-fidelity-${digestTag}-${suffix}-a${attempt}`,
                    operationId: `source-fidelity-judge-${suffix}-a${attempt}`,
                  };
                  try {
                    return await makeLiveSourceFidelityAsk({ execution: { runner, context: fidelityCtx } })(fidelityRequest);
                  } catch (error) {
                    lastError = error;
                    if (error instanceof Error && error.message.startsWith("SOURCE_FIDELITY_MODEL_CANCELLED")) throw error;
                  }
                }
                throw lastError;
              },
            });
          } catch (error) {
            // Identical rule to the answer-key judge below: a judge that could
            // not RUN has said nothing about the chapter. Committing its failure
            // as a FAIL round would manufacture a content verdict, and repair
            // refuses compiler-owned blockers, so the candidate would wedge.
            const message = (error as Error).message;
            const cancelled = message.startsWith("SOURCE_FIDELITY_MODEL_CANCELLED");
            return failed(
              cancelled ? "CANDIDATE_QC_JUDGE_CANCELLED" : "CANDIDATE_QC_JUDGE_UNAVAILABLE",
              `source-fidelity judge could not complete ${chapterLabel}: ${message}`,
            );
          }
          const classified = classifySourceFidelityFindings(fidelity);
          for (const finding of classified.issues) {
            qcIssues.push(issue(finding.code, finding.severity, finding.message, finding.location));
          }
          // R-150 — ONE RULER, READ BACK. The classification reduces through the
          // frozen `computeVerdict` the ship-side bar reduces through, and this
          // asks it to PROVE that rather than asserting it: cited hits vs
          // enforced blockers, the recorded verdict vs the frozen reduction of
          // the recorded axis, and then RED <-> blocked. The first two can fire
          // (pinned by v4-source-fidelity-judge.test.ts); the pair of branches
          // this replaces could not, because on one axis RED holds exactly when
          // a hit was cited. A round carrying a verdict its own evidence does
          // not support is the failure this package exists to stop, so a
          // disagreement is itself a BLOCKER rather than a note.
          const disagreement = sourceFidelityVetoDisagreement(classified);
          if (disagreement !== null) {
            qcIssues.push(issue("CANDIDATE_QC_FIDELITY_VETO", "BLOCKER", `${chapterLabel}: ${disagreement}`, chapterLabel));
          }
        }

        try {
          const report = await judgeQuizKeys(entry.chapter, {
            ...(quizSource === undefined ? {} : {
              sourceContext: quizSource.text,
              sourceProvenance: quizSource.provenance,
              sourceOmittedChars: quizSource.omittedChars,
            }),
            panelFlaggedQuestionIds: panelFlaggedQuestionIds(request.canonicalReview.issues, number),
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
                  return await makeLiveAskModel({
                    execution: {
                      runner,
                      context: judgeCtx,
                      ...(carriesSpan ? { profileId: "pipeline-read-json-long-v1" } : {}),
                    },
                  })(args);
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
          // R-135 — a LOW-confidence verdict is the judge saying the question is
          // under-determined, and that was the one verdict class nothing read.
          // It never blocks (the judge is not confident, so neither are we), and
          // it now reaches the repair brief as named diagnosis instead of dying
          // inside `report.all`.
          for (const verdict of report.underDetermined) {
            qcIssues.push(issue(
              "QC1.quiz_under_determined",
              "WARN",
              `quiz answer-key judge could not determine ${verdict.questionId} (low confidence; it derived index ${verdict.modelIndex}, stored correctIndex=${verdict.storedIndex}, ${verdict.agree ? "agreeing with" : "disagreeing with"} the key): ${verdict.reason}`,
              location(number, `/quiz/${verdict.questionId}`),
            ));
          }
          // R-078 — SF4 from the answer-key judge. The judge is the only reader
          // that sees the explanation and the source together, so an explanation
          // clause the source does not support is ITS finding to make.
          //
          // IT IS ENFORCED ON THE FIDELITY JUDGE'S OWN RULE, from the fidelity
          // judge's own function (`ruleCitedClaim`): the clause must be quoted
          // VERBATIM out of the explanation, at least MIN_CHAPTER_QUOTE_CHARS of
          // it, and must name something the source can settle. This path used to
          // enforce a weaker rule of its own — non-empty and contained — so a
          // judge returning ["the"] minted a ship-blocking issue that repair
          // would answer by deleting a true explanation clause.
          //
          // AND THE JUDGE MUST HAVE SEEN THE WHOLE SPAN. An SF4 finding is a
          // finding of ABSENCE, and its only evidence is that the judge did not
          // find the support. Over MAX_SPAN_PROMPT_CHARS the judge reads sampled
          // windows (the Franklin v25 spans are ~114,700 characters each), so
          // the support may sit in a window it never saw: absence from an
          // excerpt is not a verified citation, and a BLOCKER here requires one.
          // The finding is still REPORTED, naming exactly how much was omitted.
          // Under model-memory nothing here can block, as before.
          const explanations = new Map((entry.chapter.quiz?.questions ?? []).map((question) => [
            question.questionId,
            typeof question.explanation === "string" ? question.explanation : "",
          ]));
          const groundedInText = source !== undefined && source.context.provenance === "source-text";
          const excerptedSpan = groundedInText && quizSource?.excerpted === true;
          for (const verdict of report.all) {
            for (const claim of verdict.unsupportedExplanationClaims) {
              const explanation = explanations.get(verdict.questionId) ?? "";
              const ruling = ruleCitedClaim({
                claim,
                quote: claim,
                quotedIn: explanation,
                quotedInNoun: "explanation",
              });
              const notEnforced = [...ruling.notEnforced];
              if (groundedInText && quizSource === undefined) {
                // The span resolved but rendered to nothing, so the judge was
                // handed no source block at all. Same rule, harder case: a
                // finding of absence needs something to have been absent FROM.
                notEnforced.push(
                  "no source context reached the judge for this chapter (the chapter's span rendered empty),"
                  + " so it had nothing to check the explanation against",
                );
              }
              if (excerptedSpan) {
                notEnforced.push(
                  "the judge read a SAMPLED excerpt of this chapter's span, not the whole of it"
                  + ` (${quizSource?.omittedChars ?? 0} characters of it were omitted), so absence from what it read is not a verified citation`,
                );
              }
              const parts = [
                `the explanation for ${verdict.questionId} claims "${claim.replace(/\s+/g, " ").trim().slice(0, 300)}"`,
                groundedInText ? "which this chapter's source span does not support" : "which the judge could not place in the book",
              ];
              if (!groundedInText) {
                parts.push("provenance model-memory (this run carried no source text; the judge checked against its own recall, so this cannot gate)");
              }
              if (notEnforced.length > 0) parts.push(`NOT ENFORCED - ${notEnforced.join("; ")}`);
              qcIssues.push(issue(
                SOURCE_FIDELITY_EXPLANATION_CODE,
                groundedInText && notEnforced.length === 0 ? "BLOCKER" : "WARN",
                parts.join("; "),
                location(number, `/quiz/${verdict.questionId}`),
              ));
            }
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
    } else {
      // THE ROUND SAYS SO WHEN THE JUDGES DID NOT RUN.
      //
      // A deterministic-only composition (no runner, or no task context) can
      // still commit a PASS round, and until now nothing on that round recorded
      // that no chapter had been checked against the book — so "every chapter is
      // checked against the book before it can ship" was true only of a
      // correctly composed evaluator, and unprovable from the record. This is
      // publishableBar's `ran: false` ("DID NOT RUN — not a pass") in the one
      // place a QC round can carry it: an issue on the round.
      //
      // WARN, not BLOCKER: the deterministic lane is a legitimate composition
      // and this changes no verdict — it makes the absence VISIBLE, which is
      // what a record is for. A reader of the round can now tell a chapter that
      // passed the judges from one no judge ever read.
      qcIssues.push(issue(
        SOURCE_FIDELITY_NOT_RUN_CODE,
        "WARN",
        "the source-fidelity judge and the answer-key judge did NOT RUN for this round"
        + `${this.#runner === undefined ? " (no model runner was composed)" : " (no model task context was supplied)"}`
        + " — this round is not evidence that any chapter was checked against the book",
      ));
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
