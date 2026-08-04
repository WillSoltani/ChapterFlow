import { basename } from "node:path";

import type { Result } from "../../src/contracts/v4Core.js";
import { createTestRoots, type TestRoots } from "../testRoots.js";
import {
  formatRootDiffs,
  snapshotGuardedProductionRoots,
  verifyGuardedProductionRoots,
  type GuardSnapshot,
} from "./baseline.js";
import { byteSorted, deterministicSummary, FixedClock, SeededIds } from "./determinism.js";
import { FaultInjector } from "./faults.js";

const FORBIDDEN_PROVIDER_ENV = [
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_ORGANIZATION",
  "OPENAI_PROJECT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "CHAPTERFLOW_PROVIDER",
] as const;

function assertNoLiveRouteEnvironment(): void {
  const present: string[] = FORBIDDEN_PROVIDER_ENV.filter((name) => process.env[name] !== undefined);
  if (process.env.CHAPTERFLOW_ALLOW_MODEL_GEN === "1") present.push("CHAPTERFLOW_ALLOW_MODEL_GEN");
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    throw new Error("V25 tests require CHAPTERFLOW_NO_API_CODEX_QC=1 before test-module import");
  }
  if (present.length > 0) {
    throw new Error(`V25 tests refuse live model/provider environment before test-module import: ${byteSorted(present).join(", ")}`);
  }
}

assertNoLiveRouteEnvironment();
const productionBefore: GuardSnapshot = snapshotGuardedProductionRoots();

export type TestContext = {
  readonly roots: TestRoots;
  readonly seed: string;
  readonly clock: FixedClock;
  readonly ids: SeededIds;
  readonly faults: FaultInjector;
};

export type V25TestStatus = "PASS" | "FAIL" | "SKIP";

export type V25TestResult = {
  readonly name: string;
  readonly required: boolean;
  readonly status: V25TestStatus;
  readonly detail: string | null;
  readonly clock: ReturnType<FixedClock["report"]> | null;
  readonly ids: ReturnType<SeededIds["report"]> | null;
  readonly faults: ReturnType<FaultInjector["report"]> | null;
};

export type V25TestSummary = {
  readonly schemaVersion: "1";
  readonly file: string;
  readonly seed: string;
  readonly order: readonly string[];
  readonly results: readonly V25TestResult[];
  readonly pass: number;
  readonly fail: number;
  readonly skip: number;
  readonly requiredBlockers: number;
  readonly deterministicSummary: string;
};

type TestFunction = (context: TestContext) => void | Promise<void>;
type TestOptions = { readonly skip?: string };
type RegisteredTest = {
  readonly name: string;
  readonly required: boolean;
  readonly fn: TestFunction;
  readonly skipReason: string | null;
};

const registered: RegisteredTest[] = [];
let finishStarted = false;
let finishCompleted = false;

function register(name: string, required: boolean, fn: TestFunction, options: TestOptions): void {
  if (finishStarted) throw new Error(`cannot register test after finishV25Tests: ${name}`);
  if (name.trim().length === 0) throw new Error("V25 test name must not be empty");
  if (registered.some((entry) => entry.name === name)) throw new Error(`duplicate V25 test name: ${name}`);
  if (options.skip !== undefined && options.skip.trim().length === 0) {
    throw new Error(`skip reason must not be empty: ${name}`);
  }
  registered.push({ name, required, fn, skipReason: options.skip ?? null });
}

/** Optional case. FAIL/SKIP remains visible but does not satisfy required proof. */
export function test(name: string, fn: TestFunction, options: TestOptions = {}): void {
  register(name, false, fn, options);
}

/** Required case. Both FAIL and SKIP make file process exit nonzero. */
export function requiredTest(name: string, fn: TestFunction, options: TestOptions = {}): void {
  register(name, true, fn, options);
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.split("\n").slice(0, 12).join("\n");
  return String(error).split("\n").slice(0, 12).join("\n");
}

function testFileName(): string {
  const entry = process.argv[1];
  return entry ? basename(entry) : "inline-v25-test";
}

async function execute(entry: RegisteredTest, seed: string): Promise<V25TestResult> {
  if (entry.skipReason !== null) {
    return {
      name: entry.name,
      required: entry.required,
      status: "SKIP",
      detail: entry.skipReason,
      clock: null,
      ids: null,
      faults: null,
    };
  }

  const roots = createTestRoots(`cf-v25-${entry.name}`);
  const clock = new FixedClock();
  const ids = new SeededIds(seed);
  const faults = new FaultInjector();
  let outcome: Result<null> = { ok: true, value: null };
  try {
    await entry.fn({ roots, seed, clock, ids, faults });
  } catch (error) {
    outcome = { ok: false, error: { code: "V25_TEST_FAILED", message: errorDetail(error) } };
  } finally {
    try {
      roots.dispose();
    } catch (error) {
      outcome = { ok: false, error: { code: "V25_TEST_CLEANUP_FAILED", message: errorDetail(error) } };
    }
  }

  return {
    name: entry.name,
    required: entry.required,
    status: outcome.ok ? "PASS" : "FAIL",
    detail: outcome.ok ? null : `${outcome.error.code}: ${outcome.error.message}`,
    clock: clock.report(),
    ids: ids.report(),
    faults: faults.report(),
  };
}

function printResult(result: V25TestResult): void {
  const qualifier = result.required ? "required" : "optional";
  console.log(`  ${result.status} [${qualifier}] ${result.name}`);
  if (result.detail) console.log(`    ${result.detail.replace(/\n/g, "\n    ")}`);
}

export async function finishV25Tests(): Promise<V25TestSummary> {
  if (finishStarted) throw new Error("finishV25Tests may be called only once");
  finishStarted = true;

  const file = testFileName();
  const rootSeed = process.env.CHAPTERFLOW_TEST_SEED ?? "chapterflow-v25-v4";
  const ordered = [...registered].sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
  const results: V25TestResult[] = [];

  console.log(`\nV25 TEST FILE ${file}`);
  console.log(`  seed ${rootSeed}`);
  console.log(`  order ${JSON.stringify(ordered.map((entry) => entry.name))}`);

  if (ordered.length === 0) {
    results.push({
      name: "harness requires at least one registered case",
      required: true,
      status: "FAIL",
      detail: "V25_EMPTY_TEST_FILE: no test or requiredTest registrations",
      clock: null,
      ids: null,
      faults: null,
    });
  } else {
    for (let index = 0; index < ordered.length; index++) {
      const entry = ordered[index];
      results.push(await execute(entry, `${rootSeed}:${file}:${index}:${entry.name}`));
    }
  }

  try {
    const rootDiffs = verifyGuardedProductionRoots(productionBefore);
    if (rootDiffs.length > 0) {
      results.push({
        name: "guarded production roots remain byte-identical",
        required: true,
        status: "FAIL",
        detail: `V25_PRODUCTION_ROOT_MUTATION:\n${formatRootDiffs(rootDiffs)}`,
        clock: null,
        ids: null,
        faults: null,
      });
    }
  } catch (error) {
    results.push({
      name: "guarded production roots remain readable",
      required: true,
      status: "FAIL",
      detail: `V25_PRODUCTION_ROOT_GUARD_FAILED: ${errorDetail(error)}`,
      clock: null,
      ids: null,
      faults: null,
    });
  }

  for (const result of results) printResult(result);

  const pass = results.filter((result) => result.status === "PASS").length;
  const fail = results.filter((result) => result.status === "FAIL").length;
  const skip = results.filter((result) => result.status === "SKIP").length;
  const requiredBlockers = results.filter(
    (result) => result.required && (result.status === "FAIL" || result.status === "SKIP"),
  ).length;
  const stableBody = {
    schemaVersion: "1" as const,
    file,
    seed: rootSeed,
    order: ordered.map((entry) => entry.name),
    results: results.map(({ name, required, status, detail, clock, ids, faults }) => ({
      name,
      required,
      status,
      detail,
      clock,
      ids,
      faults,
    })),
    pass,
    fail,
    skip,
    requiredBlockers,
  };
  const summary: V25TestSummary = {
    ...stableBody,
    deterministicSummary: deterministicSummary(stableBody),
  };

  console.log(`  summary pass=${pass} fail=${fail} skip=${skip} required-blockers=${requiredBlockers}`);
  console.log(`  deterministic ${summary.deterministicSummary}`);
  console.log(`V25_RESULT ${JSON.stringify({
    schemaVersion: "1",
    file,
    requiredCases: results.filter((result) => result.required).length,
    requiredBlockers,
    pass,
    fail,
    skip,
  })}`);
  if (requiredBlockers > 0) process.exitCode = 1;
  finishCompleted = true;
  registered.length = 0;
  return summary;
}

process.on("exit", (code) => {
  if (!finishCompleted) {
    console.error("V25 HARNESS MISUSE: test module did not await finishV25Tests()");
    try {
      const rootDiffs = verifyGuardedProductionRoots(productionBefore);
      if (rootDiffs.length > 0) {
        console.error(`V25_PRODUCTION_ROOT_MUTATION:\n${formatRootDiffs(rootDiffs)}`);
      }
    } catch (error) {
      console.error(`V25_PRODUCTION_ROOT_GUARD_FAILED: ${errorDetail(error)}`);
    }
    if (code === 0) process.exitCode = 1;
  }
});

export type { TestRoots };
