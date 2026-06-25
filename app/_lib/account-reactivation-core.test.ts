import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REACTIVATION_WRITE_MAX_ATTEMPTS,
  isNextRedirectError,
  reactivationRetryDelayMs,
  runReactivationWrite,
  shouldRetryReactivationWrite,
} from "./account-reactivation-core";

// ── predicates ──────────────────────────────────────────────────────────────

test("isNextRedirectError: true only for a digest-carrying object (Next.js redirect)", () => {
  assert.equal(
    isNextRedirectError(
      Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;replace;/auth/login;307;",
      })
    ),
    true
  );
  assert.equal(isNextRedirectError({ digest: "NEXT_REDIRECT;..." }), true);
});

test("isNextRedirectError: false for DynamoDB/network write errors and non-objects", () => {
  assert.equal(
    isNextRedirectError(new Error("ProvisionedThroughputExceededException")),
    false
  );
  // A non-string digest is NOT a Next redirect (defensive against shape spoofing).
  assert.equal(isNextRedirectError({ digest: 123 }), false);
  assert.equal(isNextRedirectError(null), false);
  assert.equal(isNextRedirectError(undefined), false);
  assert.equal(isNextRedirectError("nope"), false);
});

test("shouldRetryReactivationWrite: retries a transient write failure until attempts run out", () => {
  const ddbError = new Error("ThrottlingException");
  for (let attempt = 1; attempt < REACTIVATION_WRITE_MAX_ATTEMPTS; attempt++) {
    assert.equal(shouldRetryReactivationWrite(attempt, ddbError), true);
  }
  assert.equal(
    shouldRetryReactivationWrite(REACTIVATION_WRITE_MAX_ATTEMPTS, ddbError),
    false
  );
  assert.equal(
    shouldRetryReactivationWrite(REACTIVATION_WRITE_MAX_ATTEMPTS + 5, ddbError),
    false
  );
});

test("shouldRetryReactivationWrite: NEVER retries a Next.js redirect (control flow)", () => {
  assert.equal(
    shouldRetryReactivationWrite(1, {
      digest: "NEXT_REDIRECT;replace;/auth/login;307;",
    }),
    false
  );
});

test("shouldRetryReactivationWrite: honors a custom maxAttempts", () => {
  const err = new Error("boom");
  assert.equal(shouldRetryReactivationWrite(1, err, 1), false);
  assert.equal(shouldRetryReactivationWrite(1, err, 2), true);
  assert.equal(shouldRetryReactivationWrite(2, err, 2), false);
});

test("reactivationRetryDelayMs: positive and capped so a render never stalls", () => {
  assert.equal(reactivationRetryDelayMs(1), 50);
  assert.equal(reactivationRetryDelayMs(2), 100);
  assert.equal(reactivationRetryDelayMs(10), 250);
  assert.ok(reactivationRetryDelayMs(1) > 0);
});

// ── runReactivationWrite: the F10 loop ───────────────────────────────────────

const noSleep = async () => {};

test("runReactivationWrite: succeeds on the first attempt, no warn/error log", async () => {
  let calls = 0;
  const logs: string[] = [];
  const outcome = await runReactivationWrite(
    async () => {
      calls += 1;
    },
    { sleep: noSleep, log: (_level, event) => logs.push(event) }
  );
  assert.deepEqual(outcome, { ok: true, attempts: 1 });
  assert.equal(calls, 1);
  assert.deepEqual(logs, []);
});

test("runReactivationWrite: retries a transient failure then recovers (warn log)", async () => {
  let calls = 0;
  const logs: Array<{ level: string; event: string }> = [];
  const outcome = await runReactivationWrite(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("ThrottlingException");
    },
    { sleep: noSleep, log: (level, event) => logs.push({ level, event }) }
  );
  assert.deepEqual(outcome, { ok: true, attempts: 2 });
  assert.equal(calls, 2);
  assert.deepEqual(logs, [
    { level: "warn", event: "account_reactivation_write_recovered" },
  ]);
});

test("F10 REGRESSION: a persistent write failure surfaces a DISTINCT terminal signal, NOT a silent success", async () => {
  // This is the bug: the reactivation write throws on every attempt. The OLD
  // code let that fall into the generic status-check catch (logged
  // `account_status_check_error`, identical to a read failure) and rendered the
  // page anyway — silently leaving the row `deactivated`.
  //
  // The fix must (a) retry up to the budget, (b) report ok:false (so the caller
  // knows the write did NOT land), and (c) emit the DISTINCT
  // `account_reactivation_write_failed` event exactly once.
  let calls = 0;
  const errorLogs: Array<{ event: string; detail: Record<string, unknown> }> =
    [];
  const writeError = new Error("ProvisionedThroughputExceededException");

  const outcome = await runReactivationWrite(
    async () => {
      calls += 1;
      throw writeError;
    },
    {
      sleep: noSleep,
      log: (level, event, detail) => {
        if (level === "error") errorLogs.push({ event, detail });
      },
    }
  );

  assert.equal(outcome.ok, false, "must NOT report a silent success");
  assert.equal(calls, REACTIVATION_WRITE_MAX_ATTEMPTS, "must exhaust the retry budget");
  assert.equal(outcome.attempts, REACTIVATION_WRITE_MAX_ATTEMPTS);
  assert.equal(
    (outcome as { ok: false; error: unknown }).error,
    writeError,
    "must carry the underlying write error for the caller"
  );
  // Exactly one terminal signal, and it is DISTINCT from the read-failure log.
  assert.equal(errorLogs.length, 1);
  assert.equal(errorLogs[0].event, "account_reactivation_write_failed");
  assert.notEqual(errorLogs[0].event, "account_status_check_error");
  assert.equal(errorLogs[0].detail.attempts, REACTIVATION_WRITE_MAX_ATTEMPTS);
});

test("runReactivationWrite: a Next.js redirect propagates (never retried/swallowed)", async () => {
  let calls = 0;
  const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/auth/login;307;",
  });
  await assert.rejects(
    () =>
      runReactivationWrite(
        async () => {
          calls += 1;
          throw redirectError;
        },
        { sleep: noSleep }
      ),
    /NEXT_REDIRECT/
  );
  assert.equal(calls, 1, "a redirect must not be retried");
});

test("runReactivationWrite: respects a custom maxAttempts budget", async () => {
  let calls = 0;
  const outcome = await runReactivationWrite(
    async () => {
      calls += 1;
      throw new Error("boom");
    },
    { sleep: noSleep, maxAttempts: 5 }
  );
  assert.equal(outcome.ok, false);
  assert.equal(calls, 5);
});
