import type { CandidateIdentity, Result } from "../contracts/v4Core.js";
import { parseLedgerBytes } from "./qcStore.js";
import type { QcIssue, QcRoundResult } from "./qcTypes.js";

export type LegacyQcOutcome = "PASS" | "FAIL" | "ERROR";

export interface LegacyQcProjection {
  readonly bookId: string;
  readonly roundId: string;
  readonly candidate: CandidateIdentity;
  readonly reviewId: string;
  readonly outcome: LegacyQcOutcome;
  readonly issues: readonly QcIssue[];
}

export interface NormalizedQcProjection {
  readonly bookId: string;
  readonly roundId: string;
  readonly candidate: CandidateIdentity;
  readonly reviewId: string;
  readonly outcome: LegacyQcOutcome;
  readonly issues: readonly QcIssue[];
}

export interface QcWriterCohortState {
  readonly bookId: string;
  readonly legacyWriterEnabled: boolean;
  readonly v4WriterEnabled: boolean;
  readonly cutoverComplete: boolean;
  readonly v4WriteObserved: boolean;
}

export type QcWriterRoute = "LEGACY" | "V4" | "DISABLED";

function failed<T>(code: string, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

function cloneIssues(issues: readonly QcIssue[]): readonly QcIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

/** Byte-only dry-run. Malformed input is reported, never repaired or quarantined. */
export function inspectQcLedgerDryRun(bytes: Uint8Array): Result<Readonly<{
  revision: number;
  rounds: readonly QcRoundResult[];
}>> {
  const parsed = parseLedgerBytes(bytes);
  if (parsed.issues.length > 0 || parsed.events.length === 0) {
    const detail = parsed.issues.length > 0 ? parsed.issues.join("; ") : "ledger has no valid events";
    return failed("QC_LEDGER_MALFORMED", `QC ledger is malformed: ${detail}`);
  }
  return {
    ok: true,
    value: {
      revision: parsed.events.length,
      rounds: parsed.events
        .filter((event) => event.kind === "ROUND")
        .map((event) => ({ ...event.round, candidate: { ...event.round.candidate }, issues: cloneIssues(event.round.issues) })),
    },
  };
}

/** Read-only compatibility mapping. Legacy state remains authoritative before cutover. */
export function normalizeLegacyQcProjection(input: LegacyQcProjection): NormalizedQcProjection {
  return {
    bookId: input.bookId,
    roundId: input.roundId,
    candidate: { ...input.candidate },
    reviewId: input.reviewId,
    outcome: input.outcome,
    issues: cloneIssues(input.issues),
  };
}

export function normalizeV4QcProjection(bookId: string, round: QcRoundResult): NormalizedQcProjection {
  return {
    bookId,
    roundId: round.roundId,
    candidate: { ...round.candidate },
    reviewId: round.reviewId,
    outcome: round.outcome,
    issues: cloneIssues(round.issues),
  };
}

export function qcShadowParity(
  legacy: LegacyQcProjection,
  v4: QcRoundResult,
): Result<Readonly<{ legacy: NormalizedQcProjection; v4: NormalizedQcProjection }>> {
  const left = normalizeLegacyQcProjection(legacy);
  const right = normalizeV4QcProjection(legacy.bookId, v4);
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    return failed("QC_SHADOW_PARITY_MISMATCH", "legacy and V4 QC projections differ");
  }
  return { ok: true, value: { legacy: left, v4: right } };
}

/** Fail closed unless exactly one authority writer is valid for cohort phase. */
export function checkQcWriterCutover(state: QcWriterCohortState): Result<QcWriterRoute> {
  if (state.legacyWriterEnabled && state.v4WriterEnabled) {
    return failed("QC_MIXED_WRITERS_BLOCKED", `legacy and V4 QC writers are both enabled for ${state.bookId}`);
  }
  if (state.v4WriteObserved && state.legacyWriterEnabled) {
    return failed("QC_LEGACY_WRITER_AFTER_V4_WRITE", `legacy QC writer cannot resume after a V4 write for ${state.bookId}`);
  }
  if (!state.cutoverComplete && state.v4WriterEnabled) {
    return failed("QC_V4_WRITER_BEFORE_CUTOVER", `V4 QC writer cannot start before cohort cutover for ${state.bookId}`);
  }
  if (state.cutoverComplete && state.legacyWriterEnabled) {
    return failed("QC_LEGACY_WRITER_AFTER_CUTOVER", `legacy QC writer must be disabled after cohort cutover for ${state.bookId}`);
  }
  if (state.legacyWriterEnabled) return { ok: true, value: "LEGACY" };
  if (state.v4WriterEnabled) return { ok: true, value: "V4" };
  return { ok: true, value: "DISABLED" };
}
