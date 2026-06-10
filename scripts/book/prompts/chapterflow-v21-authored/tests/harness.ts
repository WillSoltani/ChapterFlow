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

export type TestStatus = "pass" | "fail" | "xfail" | "xpass" | "skip";

export type TestResult = {
  name: string;
  status: TestStatus;
  reason?: string;   // xfail reason or skip reason
  error?: string;    // failure detail
};

type RegisteredTest = {
  name: string;
  fn: () => void | Promise<void>;
  xfailReason?: string;
  skipReason?: string;
};

const registry: RegisteredTest[] = [];

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

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message.split("\n").slice(0, 6).join("\n");
  return String(e);
}

/** Run every registered test, clear the registry, return results. */
export async function runRegistered(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const t of registry) {
    if (t.skipReason) {
      results.push({ name: t.name, status: "skip", reason: t.skipReason });
      continue;
    }
    let threw: unknown = null;
    let failed = false;
    try {
      await t.fn();
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
