import type { CandidateInputFile, CandidateSnapshot, CandidateStore } from "../books/candidateTypes.js";
import type {
  CandidateIdentity,
  PlannedArtifact,
  QcRoundId,
  RepairId,
  Result,
  RunId,
  UtcIso,
} from "../contracts/v4Core.js";
import type { RepairHistoryRecord, RepairHistoryStore } from "./repairHistoryStore.js";
import type { QcDiagnosis, QcRoundResult, QcService } from "./qcTypes.js";

export interface DiagnosisLookup {
  getDiagnosis(bookId: string, diagnosisId: string): Promise<Result<QcDiagnosis>>;
}

export interface RepairRequest {
  readonly repairId: RepairId;
  readonly bookId: string;
  readonly failedCandidate: CandidateIdentity;
  readonly failedRoundId: QcRoundId;
  readonly diagnosisId?: string;
  readonly successorCandidateId: string;
  readonly createdByRunId: RunId;
  readonly expectedInventory: readonly PlannedArtifact[];
  readonly files: readonly CandidateInputFile[];
  readonly createdAt: UtcIso;
}

export interface RepairResult {
  readonly repairId: RepairId;
  readonly predecessor: CandidateIdentity;
  readonly successor: CandidateIdentity;
  readonly failedRoundId: QcRoundId;
  readonly attemptNumber: number;
  readonly requiredNextStep: "CANONICAL_REVIEW";
}

export interface RepairService {
  createSuccessor(request: RepairRequest): Promise<Result<RepairResult>>;
}

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function identityOf(candidate: CandidateSnapshot): CandidateIdentity {
  return { candidateId: candidate.manifest.candidateId, manifestDigest: candidate.manifest.manifestDigest };
}

function sameIdentity(left: CandidateIdentity, right: CandidateIdentity): boolean {
  return left.candidateId === right.candidateId && left.manifestDigest === right.manifestDigest;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function matchesExisting(snapshot: CandidateSnapshot, request: RepairRequest): boolean {
  const manifest = snapshot.manifest;
  if (manifest.bookId !== request.bookId
    || manifest.candidateId !== request.successorCandidateId
    || manifest.parentCandidateId !== request.failedCandidate.candidateId
    || manifest.createdByRunId !== request.createdByRunId
    || manifest.createdAt !== request.createdAt
    || snapshot.files.length !== request.files.length) return false;
  const files = new Map(request.files.map((file) => [file.logicalPath, file] as const));
  return snapshot.files.every((file) => {
    const expected = files.get(file.logicalPath);
    return expected !== undefined
      && expected.kind === file.kind
      && expected.mediaType === file.mediaType
      && sameBytes(expected.bytes, file.bytes);
  });
}

function priorUnsuccessful(records: readonly RepairHistoryRecord[], request: RepairRequest): boolean {
  return records.some((record) => record.qcOutcome !== "PASS"
    && record.freshRoundId === request.failedRoundId
    && sameIdentity(record.successor, request.failedCandidate));
}

function failedRoundMatches(round: QcRoundResult, request: RepairRequest): boolean {
  return round.roundId === request.failedRoundId
    && round.outcome === "FAIL"
    && sameIdentity(round.candidate, request.failedCandidate);
}

function diagnosisMatches(diagnosis: QcDiagnosis, request: RepairRequest): boolean {
  return diagnosis.diagnosisId === request.diagnosisId
    && diagnosis.roundId === request.failedRoundId
    && sameIdentity(diagnosis.candidate, request.failedCandidate);
}

export class CandidateRepairService implements RepairService {
  readonly #candidates: CandidateStore;
  readonly #history: RepairHistoryStore;
  readonly #qc: QcService;
  readonly #diagnoses: DiagnosisLookup;

  constructor(dependencies: Readonly<{
    candidates: CandidateStore;
    history: RepairHistoryStore;
    qc: QcService;
    diagnoses: DiagnosisLookup;
  }>) {
    this.#candidates = dependencies.candidates;
    this.#history = dependencies.history;
    this.#qc = dependencies.qc;
    this.#diagnoses = dependencies.diagnoses;
  }

  async createSuccessor(request: RepairRequest): Promise<Result<RepairResult>> {
    if (request.failedCandidate.candidateId === request.successorCandidateId) {
      return failed("REPAIR_IDENTITY_MISMATCH", "successor candidate ID must be new");
    }
    const predecessor = await this.#candidates.open({
      bookId: request.bookId,
      selector: { kind: "CANDIDATE", candidateId: request.failedCandidate.candidateId },
    });
    if (!predecessor.ok) return predecessor;
    if (!sameIdentity(identityOf(predecessor.value), request.failedCandidate)) {
      return failed("REPAIR_FAILED_CANDIDATE_STALE", "failed candidate digest no longer matches repair request");
    }
    const failedRound = await this.#qc.getRound(request.bookId, request.failedRoundId);
    if (!failedRound.ok) return failed("REPAIR_FAILED_QC_REQUIRED", failedRound.error.message);
    if (!failedRoundMatches(failedRound.value, request)) {
      return failed("REPAIR_FAILED_QC_STALE", "failed QC round does not match failed candidate and digest");
    }
    const history = await this.#history.list(request.bookId);
    if (!history.ok) return history;
    const attemptNumber = history.value.reduce((highest, record) => Math.max(highest, record.ordinal), 0) + 1;
    const diagnosisRequired = priorUnsuccessful(history.value, request);
    if (diagnosisRequired && !request.diagnosisId) {
      return failed("REPAIR_DIAGNOSIS_REQUIRED", "second unsuccessful repair loop requires current diagnosis");
    }
    if (diagnosisRequired || request.diagnosisId) {
      const diagnosis = await this.#diagnoses.getDiagnosis(request.bookId, request.diagnosisId!);
      if (!diagnosis.ok) return failed("REPAIR_DIAGNOSIS_REQUIRED", diagnosis.error.message);
      if (!diagnosisMatches(diagnosis.value, request)) {
        return failed("REPAIR_DIAGNOSIS_STALE", "diagnosis does not match failed book, candidate, digest, and round");
      }
    }
    if (request.files.length === 0 || request.expectedInventory.length === 0) {
      return failed("REPAIR_OUTPUT_INVALID", "repair requires prepared successor files and inventory");
    }

    let successor = await this.#candidates.open({
      bookId: request.bookId,
      selector: { kind: "CANDIDATE", candidateId: request.successorCandidateId },
    });
    if (successor.ok && !matchesExisting(successor.value, request)) {
      return failed("REPAIR_SUCCESSOR_CONFLICT", `successor candidate differs from repair request: ${request.successorCandidateId}`);
    }
    if (!successor.ok) {
      if (successor.error.code !== "CANDIDATE_NOT_FOUND") return successor;
      const staged = await this.#candidates.stage({
        bookId: request.bookId,
        candidateId: request.successorCandidateId,
        parentCandidateId: request.failedCandidate.candidateId,
        createdByRunId: request.createdByRunId,
        expectedInventory: request.expectedInventory,
        files: request.files,
        createdAt: request.createdAt,
      });
      if (!staged.ok && staged.error.code !== "CANDIDATE_EXISTS") return staged;
      successor = await this.#candidates.open({
        bookId: request.bookId,
        selector: { kind: "CANDIDATE", candidateId: request.successorCandidateId },
      });
      if (!successor.ok) return successor;
      if (!matchesExisting(successor.value, request)) {
        return failed("REPAIR_SUCCESSOR_CONFLICT", `successor candidate differs from repair request: ${request.successorCandidateId}`);
      }
    }
    const successorIdentity = identityOf(successor.value);
    if (successorIdentity.manifestDigest === request.failedCandidate.manifestDigest) {
      return failed("REPAIR_SUCCESSOR_CONFLICT", "successor digest must differ from predecessor digest");
    }
    return {
      ok: true,
      value: {
        repairId: request.repairId,
        predecessor: request.failedCandidate,
        successor: successorIdentity,
        failedRoundId: request.failedRoundId,
        attemptNumber,
        requiredNextStep: "CANONICAL_REVIEW",
      },
    };
  }
}
