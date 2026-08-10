// idempotency-core.ts — storage-agnostic request deduplication (WP-IDEMPOTENCY-01).
//
// The iOS client stamps every retryable durable write with a stable mutation
// identity (`PendingMutation.mutationId`, minted once at journal enqueue and
// reused verbatim on retry) in the `Idempotency-Key` header. This module turns
// that key into server-side dedupe: the FIRST request for a given
// (account, key) executes and its outcome is stored; any REPEAT of the same
// (account, key) replays that stored outcome WITHOUT re-executing, so a retry
// can never double-apply.
//
// This file is intentionally pure (no `server-only`, no DynamoDB, no Request):
// the decision logic is unit-tested against an in-memory store. The DynamoDB
// implementation of `IdempotencyStore` lives in idempotency-repo.ts.

/** The HTTP header the iOS client uses to carry its stable mutation identity. */
export const IDEMPOTENCY_HEADER = "idempotency-key";

/** A serialized, replayable outcome of a completed durable write. */
export interface StoredIdempotentOutcome {
  /** HTTP status the first execution returned. */
  status: number;
  /** JSON-serialized response body the first execution returned. */
  bodyJson: string;
}

/** Result of attempting to reserve a key for execution. */
export type ReserveResult =
  | { kind: "reserved" }
  | { kind: "replay"; outcome: StoredIdempotentOutcome }
  | { kind: "in_progress" };

/**
 * Persistence seam for idempotency records, scoped per (accountId, key). An
 * implementation MUST make `reserve` atomic: exactly one concurrent caller may
 * receive `{ kind: "reserved" }` for a not-yet-seen (accountId, key).
 */
export interface IdempotencyStore {
  /**
   * Atomically claim (accountId, key) for execution.
   * - `reserved`    — caller now owns execution and must `complete` or `release`.
   * - `replay`      — a completed outcome already exists; return it, do not execute.
   * - `in_progress` — another caller reserved it but has not completed yet.
   */
  reserve(accountId: string, key: string): Promise<ReserveResult>;
  /** Persist the outcome so future reserves of the same key replay it. */
  complete(accountId: string, key: string, outcome: StoredIdempotentOutcome): Promise<void>;
  /** Free a reservation that failed to produce a stored outcome, so it can retry. */
  release(accountId: string, key: string): Promise<void>;
}

/** The concrete work a route performs when it owns execution of a key. */
export interface IdempotentExecuteResult {
  status: number;
  body: unknown;
}

/** Outcome of {@link runIdempotent}. */
export type RunIdempotentResult =
  | { kind: "applied"; status: number; body: unknown }
  | { kind: "replayed"; status: number; body: unknown }
  | { kind: "in_progress" };

/**
 * Runs `execute` at most once per (accountId, key) and replays the stored
 * outcome on every repeat.
 *
 * - No/empty key → executes every time (the header is optional; a client that
 *   omits it, or a route reached without one, behaves exactly as before dedupe).
 * - `execute` throws → the reservation is released and the error rethrown, so a
 *   transient/validation failure never poisons the key (the client may retry).
 * - Only successful executions are stored and later replayed.
 */
export async function runIdempotent(args: {
  store: IdempotencyStore;
  accountId: string;
  key: string | null | undefined;
  execute: () => Promise<IdempotentExecuteResult>;
}): Promise<RunIdempotentResult> {
  const { store, accountId, key, execute } = args;
  const trimmed = typeof key === "string" ? key.trim() : "";

  if (!trimmed) {
    const result = await execute();
    return { kind: "applied", status: result.status, body: result.body };
  }

  const reservation = await store.reserve(accountId, trimmed);

  if (reservation.kind === "replay") {
    return {
      kind: "replayed",
      status: reservation.outcome.status,
      body: JSON.parse(reservation.outcome.bodyJson),
    };
  }

  if (reservation.kind === "in_progress") {
    return { kind: "in_progress" };
  }

  // We hold the reservation and are the sole executor for this key.
  let result: IdempotentExecuteResult;
  try {
    result = await execute();
  } catch (error) {
    await store.release(accountId, trimmed);
    throw error;
  }

  await store.complete(accountId, trimmed, {
    status: result.status,
    bodyJson: JSON.stringify(result.body ?? null),
  });
  return { kind: "applied", status: result.status, body: result.body };
}

/**
 * In-memory {@link IdempotencyStore} for unit tests. NOT for production use —
 * it is process-local and unbounded. The DynamoDB store in idempotency-repo.ts
 * provides the durable, cross-instance, atomic implementation.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<
    string,
    { status: "in_progress" | "completed"; outcome?: StoredIdempotentOutcome }
  >();

  private id(accountId: string, key: string): string {
    // Length-prefix the account id so it cannot bleed into the key across the
    // composite map key (account ids and keys are otherwise opaque strings).
    return `${accountId.length}:${accountId}:${key}`;
  }

  async reserve(accountId: string, key: string): Promise<ReserveResult> {
    const id = this.id(accountId, key);
    const existing = this.records.get(id);
    if (!existing) {
      this.records.set(id, { status: "in_progress" });
      return { kind: "reserved" };
    }
    if (existing.status === "completed" && existing.outcome) {
      return { kind: "replay", outcome: existing.outcome };
    }
    return { kind: "in_progress" };
  }

  async complete(accountId: string, key: string, outcome: StoredIdempotentOutcome): Promise<void> {
    this.records.set(this.id(accountId, key), { status: "completed", outcome });
  }

  async release(accountId: string, key: string): Promise<void> {
    const id = this.id(accountId, key);
    if (this.records.get(id)?.status === "in_progress") {
      this.records.delete(id);
    }
  }
}
