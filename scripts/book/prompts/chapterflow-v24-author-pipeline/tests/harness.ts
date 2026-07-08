/**
 * Micro test harness — zero dependencies, runs under the same `npx tsx`
 * the rest of the pipeline uses. See tests/README.md for the run command
 * and the xfail policy.
 *
 * xfail = a test that DOCUMENTS a known, verified defect. It passes the
 * suite while the defect exists and FAILS the suite (as XPASS) the moment
 * the defect is fixed — forcing the fixer to promote it to a real test()
 * in the same change. This is how Phase-1 work items stay pinned to code.
 */

export type TestStatus = "pass" | "fail" | "xfail" | "xpass" | "skip" | "xenv";

export type TestResult = {
  name: string;
  status: TestStatus;
  reason?: string;   // xfail reason, skip reason, or xenv (env-absent) reason
  error?: string;    // failure detail
};

type RegisteredTest = {
  name: string;
  fn: () => void | Promise<void>;
  xfailReason?: string;
  skipReason?: string;
  /** expected-env-failure marker (see xenv()). */
  xenv?: { reason: string; precondition: () => boolean };
};

const registry: RegisteredTest[] = [];

/** Set true once runRegistered actually executes tests. Used by the wrong-runner guard below. */
let everRan = false;

// WRONG-RUNNER GUARD. This harness uses its OWN registry; the assertions run only when
// `runRegistered()` is called (by `npx tsx tests/run.ts`). If a file is loaded with
// `node --test` / `tsx --test` instead, node:test sees no native cases and reports the FILE as
// "ok" while the harness assertions NEVER RUN — a wrong-runner invocation silently masquerades as
// green. Fail loudly at exit when tests were registered but never run, so that can't happen.
process.on("exit", (code) => {
  if (registry.length > 0 && !everRan) {
    console.error(`\n✗ HARNESS MISUSE: ${registry.length} test(s) registered but never executed — run the suite with \`npx tsx tests/run.ts\` (NOT \`tsx --test\` / \`node --test\`, which only IMPORTS the files). See tests/README.md.`);
    if (code === 0) process.exitCode = 1;
  }
});

/** A normal test: throws = FAIL. */
export function test(name: string, fn: () => void | Promise<void>): void {
  registry.push({ name, fn });
}

/** A test that codifies a KNOWN defect: it must currently fail.
 *  When the defect is fixed the test reports XPASS, which fails the suite,
 *  so the fix and the xfail-promotion land together. */
export function xfail(name: string, reason: string, fn: () => void | Promise<void>): void {
  registry.push({ name, fn, xfailReason: reason });
}

/** Skip with an explicit reason (e.g. corpus files not on this machine). */
export function skip(name: string, reason: string): void {
  registry.push({ name, fn: () => {}, skipReason: reason });
}

/**
 * Expected ENVIRONMENT failure — a test that can only run where a required
 * environment precondition holds (e.g. the real, tracked gold corpus is on
 * disk). Semantics:
 *   - precondition() FALSE  → the test reports `xenv` (env-absent, machine-
 *     checked), never a silent pass and never a red FAIL. This is what a bare
 *     checkout without the corpus sees.
 *   - precondition() TRUE   → the test RUNS normally (a throw is a real FAIL).
 *     A corpus-complete checkout executes every assertion.
 *
 * The precondition MUST be a real check (typically file existence), NOT a name
 * allowlist — otherwise `xenv` could be used to hide a genuine regression. Unlike
 * `skip()` (unconditional, forgotten-forever), the precondition is re-evaluated
 * every run, so the test switches itself back on the moment its corpus appears.
 */
export function xenv(name: string, reason: string, precondition: () => boolean, fn: () => void | Promise<void>): void {
  registry.push({ name, fn, xenv: { reason, precondition } });
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message.split("\n").slice(0, 6).join("\n");
  return String(e);
}

/** Run every registered test, clear the registry, return results. */
export async function runRegistered(): Promise<TestResult[]> {
  everRan = true; // mark the suite as actually executed (defeats the wrong-runner guard)
  const results: TestResult[] = [];
  for (const t of registry) {
    if (t.skipReason) {
      results.push({ name: t.name, status: "skip", reason: t.skipReason });
      continue;
    }
    if (t.xenv) {
      // Env-absent → xenv (machine-checked skip-with-reason). Precondition PRESENT
      // → fall through and run the test normally, so a real regression on a
      // corpus-complete checkout still fails. A precondition that itself throws is
      // treated as absent (fail closed to xenv, never a false green).
      let present = false;
      try { present = t.xenv.precondition(); } catch { present = false; }
      if (!present) {
        results.push({ name: t.name, status: "xenv", reason: t.xenv.reason });
        continue;
      }
    }
    let threw: unknown = null;
    let failed = false;
    try {
      if (process.env.CHAPTERFLOW_TEST_TRACE === "1") console.log(`  → ${t.name}`);
      const timeoutMs = Number(process.env.CHAPTERFLOW_TEST_TIMEOUT_MS ?? "0");
      if (timeoutMs > 0) {
        await Promise.race([
          Promise.resolve().then(() => t.fn()),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`test timed out after ${timeoutMs}ms: ${t.name}`)), timeoutMs)),
        ]);
      } else {
        await t.fn();
      }
    } catch (e) {
      failed = true;
      threw = e;
    }
    if (t.xfailReason) {
      if (failed) {
        results.push({ name: t.name, status: "xfail", reason: t.xfailReason });
      } else {
        results.push({
          name: t.name,
          status: "xpass",
          reason: t.xfailReason,
          error:
            "Expected to fail but PASSED. The documented defect appears fixed — " +
            "promote this xfail() to test() in the same change.",
        });
      }
    } else if (failed) {
      results.push({ name: t.name, status: "fail", error: describeError(threw) });
    } else {
      results.push({ name: t.name, status: "pass" });
    }
  }
  registry.length = 0;
  return results;
}
