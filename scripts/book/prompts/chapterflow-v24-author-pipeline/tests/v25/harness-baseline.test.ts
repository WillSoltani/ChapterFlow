import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { finishV25Tests, requiredTest, test } from "./harness.js";
import {
  captureBaseline,
  diffRootSnapshots,
  formatRootDiffs,
  notRunBaselineCheck,
  PIPELINE_ROOT,
  runBaselineCheck,
  snapshotRoots,
} from "./baseline.js";
import { byteSorted, deterministicSummary, FixedClock, SeededIds } from "./determinism.js";
import { FaultInjector, InjectedFault } from "./faults.js";
import { createTestRoots } from "../testRoots.js";

const FORBIDDEN_ENV = [
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

function noLiveEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CHAPTERFLOW_NO_API_CODEX_QC: "1",
    CHAPTERFLOW_ALLOW_MODEL_GEN: "0",
    CHAPTERFLOW_LEAK_GUARD: "1",
    ...extra,
  };
  for (const name of FORBIDDEN_ENV) {
    if (!(name in extra)) delete env[name];
  }
  return env;
}

function runTypeScriptFile(file: string, env = noLiveEnvironment()): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [...process.execArgv, file], {
    cwd: PIPELINE_ROOT,
    env,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function combinedOutput(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function deterministicRun(seed: string, cases: readonly string[]): {
  readonly order: readonly string[];
  readonly ids: readonly string[];
  readonly times: readonly string[];
  readonly summary: string;
} {
  const clock = new FixedClock("2026-07-20T12:00:00.000Z");
  const ids = new SeededIds(seed);
  const order = byteSorted(cases);
  const output = {
    order,
    ids: order.map(() => ids.next("case")),
    times: order.map((_, index) => {
      if (index > 0) clock.advance(250);
      return clock.now();
    }),
  };
  return { ...output, summary: deterministicSummary(output) };
}

requiredTest("deterministic clock IDs case order and summary repeat", ({ clock, ids }) => {
  assert.deepEqual(
    deterministicRun("seed-alpha", ["zeta", "alpha", "éclair", "beta"]),
    deterministicRun("seed-alpha", ["beta", "éclair", "zeta", "alpha"]),
  );
  assert.notDeepEqual(
    deterministicRun("seed-alpha", ["alpha"]),
    deterministicRun("seed-beta", ["alpha"]),
  );

  assert.equal(clock.now(), "2026-01-01T00:00:00.000Z");
  assert.equal(clock.now(), "2026-01-01T00:00:00.000Z", "clock cannot advance through observation");
  assert.equal(clock.advance(1_000), "2026-01-01T00:00:01.000Z");
  assert.match(ids.next("acceptance"), /^acceptance-[a-f0-9]{24}$/);
});

requiredTest("required FAIL and SKIP fail closed while optional SKIP stays visible", ({ roots }) => {
  const harnessUrl = pathToFileURL(resolve(PIPELINE_ROOT, "tests/v25/harness.ts")).href;
  const fixtures = [
    {
      name: "required-skip.mts",
      source: `import { requiredTest, finishV25Tests } from ${JSON.stringify(harnessUrl)};\nrequiredTest("fixture required skip", () => {}, { skip: "fixture skip" });\nawait finishV25Tests();\n`,
      expectedStatus: 1,
      expectedText: "SKIP [required] fixture required skip",
    },
    {
      name: "required-fail.mts",
      source: `import { requiredTest, finishV25Tests } from ${JSON.stringify(harnessUrl)};\nrequiredTest("fixture required fail", () => { throw new Error("fixture failure"); });\nawait finishV25Tests();\n`,
      expectedStatus: 1,
      expectedText: "FAIL [required] fixture required fail",
    },
    {
      name: "optional-skip.mts",
      source: `import { test, finishV25Tests } from ${JSON.stringify(harnessUrl)};\ntest("fixture optional skip", () => {}, { skip: "fixture skip" });\nawait finishV25Tests();\n`,
      expectedStatus: 0,
      expectedText: "SKIP [optional] fixture optional skip",
    },
  ] as const;

  for (const fixture of fixtures) {
    const path = join(roots.tempRoot, fixture.name);
    writeFileSync(path, fixture.source);
    const result = runTypeScriptFile(path);
    assert.equal(result.status, fixture.expectedStatus, combinedOutput(result));
    assert.match(combinedOutput(result), new RegExp(fixture.expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const emptyFiltered = spawnSync(
    process.execPath,
    [...process.execArgv, resolve(PIPELINE_ROOT, "tests/v25/run.ts"), "no-such-v25-test-filter"],
    {
      cwd: PIPELINE_ROOT,
      env: noLiveEnvironment(),
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(emptyFiltered.status, 1, combinedOutput(emptyFiltered));
  assert.match(combinedOutput(emptyFiltered), /V25 RUNNER EMPTY FILTER/);

  const copiedRunnerDir = join(roots.tempRoot, "runner-with-empty-file");
  mkdirSync(copiedRunnerDir);
  const copiedRunner = join(copiedRunnerDir, "run.ts");
  writeFileSync(copiedRunner, readFileSync(resolve(PIPELINE_ROOT, "tests/v25/run.ts"), "utf8"));
  writeFileSync(join(copiedRunnerDir, "empty.test.ts"), "console.log('no harness registrations');\n");
  const noProtocol = runTypeScriptFile(copiedRunner);
  assert.equal(noProtocol.status, 1, combinedOutput(noProtocol));
  assert.match(combinedOutput(noProtocol), /missing or invalid V25_RESULT protocol/);
});

requiredTest("strong root snapshot reports exact synthetic changed paths", ({ roots }) => {
  const synthetic = join(roots.tempRoot, "synthetic-production");
  mkdirSync(synthetic);
  const descriptor = [{ name: "synthetic-production", path: synthetic }] as const;
  const before = snapshotRoots(descriptor);
  const nested = join(synthetic, "nested");
  const file = join(nested, "file.txt");
  mkdirSync(nested);
  writeFileSync(file, "alpha");
  const after = snapshotRoots(descriptor);
  const diff = diffRootSnapshots(before, after);
  assert.deepEqual(diff.flatMap((item) => item.added), [
    "synthetic-production/nested",
    "synthetic-production/nested/file.txt",
  ]);
  assert.match(formatRootDiffs(diff), /\+ synthetic-production\/nested\/file\.txt/);

  const sameSizeBefore = snapshotRoots(descriptor);
  const oldTimes = statSync(file);
  writeFileSync(file, "bravo");
  utimesSync(file, oldTimes.atime, oldTimes.mtime);
  const byteDiff = diffRootSnapshots(sameSizeBefore, snapshotRoots(descriptor));
  assert.ok(byteDiff.flatMap((item) => item.changed).includes("synthetic-production/nested/file.txt"));
});

requiredTest("disposable roots are unique complete idempotent and symlink safe", ({ roots }) => {
  const osTemp = resolve(tmpdir());
  const relativeToTemp = relative(osTemp, roots.base);
  assert.ok(relativeToTemp !== "" && relativeToTemp !== ".." && !relativeToTemp.startsWith(`..${sep}`));
  for (const path of [roots.booksRoot, roots.stateRoot, roots.logsRoot, roots.attemptsRoot, roots.tempRoot]) {
    assert.ok(lstatSync(path).isDirectory(), `missing disposable subroot: ${path}`);
  }

  const disposable = createTestRoots("../../hostile prefix");
  const outside = mkdtempSync(join(tmpdir(), "cf-v25-outside-"));
  const sentinel = join(outside, "sentinel.txt");
  writeFileSync(sentinel, "preserve me");
  try {
    const link = join(disposable.tempRoot, "outside-link");
    symlinkSync(outside, link, "dir");
    disposable.dispose();
    disposable.dispose();
    assert.equal(readFileSync(sentinel, "utf8"), "preserve me");

    symlinkSync(outside, disposable.base, "dir");
    disposable.dispose();
    assert.equal(existsSync(disposable.base), false, "replacement symlink itself must be removed");
    assert.equal(readFileSync(sentinel, "utf8"), "preserve me");
  } finally {
    try { disposable.dispose(); } catch { /* assertion reports primary failure */ }
    rmSync(outside, { recursive: true, force: true });
  }
});

requiredTest("named faults fail only armed reach and report stable counts", ({ faults }) => {
  faults.reach("unarmed.path");
  faults.arm("before.pointer-replace", 2);
  faults.reach("before.pointer-replace");
  assert.throws(
    () => faults.reach("before.pointer-replace"),
    (error: unknown) => error instanceof InjectedFault
      && error.point === "before.pointer-replace"
      && error.reachCount === 2
      && error.message === "injected fault: before.pointer-replace (reach 2)",
  );
  assert.doesNotThrow(() => faults.reach("before.pointer-replace"));
  assert.deepEqual(faults.report(), [
    { name: "before.pointer-replace", reachCount: 3, armedAtReach: 2 },
    { name: "unarmed.path", reachCount: 1, armedAtReach: null },
  ]);

  const clean = new FaultInjector();
  assert.doesNotThrow(() => clean.reach("not-armed"));
});

requiredTest("live provider environment blocks before test dependency import", ({ roots }) => {
  const marker = join(roots.tempRoot, "imported.marker");
  const sideEffect = join(roots.tempRoot, "side-effect.mjs");
  writeFileSync(
    sideEffect,
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "imported");\n`,
  );
  const harnessUrl = pathToFileURL(resolve(PIPELINE_ROOT, "tests/v25/harness.ts")).href;
  const sideEffectUrl = pathToFileURL(sideEffect).href;
  const fixture = join(roots.tempRoot, "forbidden-env.mts");
  writeFileSync(
    fixture,
    `import { requiredTest, finishV25Tests } from ${JSON.stringify(harnessUrl)};\nimport ${JSON.stringify(sideEffectUrl)};\nrequiredTest("must not register", () => {});\nawait finishV25Tests();\n`,
  );
  const result = runTypeScriptFile(fixture, noLiveEnvironment({ OPENAI_API_KEY: "fixture-never-used" }));
  assert.notEqual(result.status, 0, combinedOutput(result));
  assert.match(combinedOutput(result), /refuse live model\/provider environment before test-module import/);
  assert.equal(existsSync(marker), false, "dependency import must not run after live-route rejection");
});

requiredTest("owner driver manifest exactly matches tracked inventory without driver import", () => {
  const inventoryResult = spawnSync(
    "git",
    ["ls-files", "--", "state/migration-experiments/_owner-inputs/*.mts"],
    { cwd: PIPELINE_ROOT, encoding: "utf8", env: { ...process.env, LC_ALL: "C" } },
  );
  assert.equal(inventoryResult.status, 0, inventoryResult.stderr);
  const inventory = byteSorted(inventoryResult.stdout.trim().split("\n").filter(Boolean));
  assert.equal(inventory.length, 16);

  const config = JSON.parse(readFileSync(resolve(PIPELINE_ROOT, "tsconfig.owner-drivers.json"), "utf8")) as {
    compilerOptions?: { noEmit?: unknown };
    files?: unknown;
    include?: unknown;
  };
  assert.equal(config.compilerOptions?.noEmit, true);
  assert.deepEqual(config.files, inventory);
  assert.deepEqual(config.include, []);
});

requiredTest("baseline preserves failure status and reports tools checks and guarded inventory", () => {
  const failed = runBaselineCheck("typecheck", process.execPath, ["-e", "process.exit(7)"], {
    cwd: PIPELINE_ROOT,
    env: noLiveEnvironment(),
  });
  assert.equal(failed.status, "FAIL");
  assert.equal(failed.exitCode, 7);

  const typecheck = runBaselineCheck("typecheck", "npm", ["run", "typecheck"], {
    cwd: PIPELINE_ROOT,
    env: noLiveEnvironment(),
  });
  assert.equal(typecheck.status, "PASS", typecheck.detail);

  const report = captureBaseline({
    capturedAt: "2026-07-20T12:00:00.000Z",
    typecheck,
    focusedTest: notRunBaselineCheck(
      "focused-test",
      "npx tsx tests/v25/run.ts harness-baseline",
      "outer package verification owns focused run",
    ),
  });
  assert.equal(report.checks.typecheck.status, "PASS");
  assert.equal(failed.status, "FAIL", "failure fixture must never become pass or skip");
  assert.equal(report.checks.focusedTest.status, "NOT_RUN");
  assert.match(report.toolVersions.node, /^v20\./);
  assert.equal(report.toolVersions.typescript, "5.9.3");
  assert.equal(report.toolVersions.tsx, "4.22.4");
  assert.deepEqual(byteSorted(report.guardedRoots.map((root) => root.name)), byteSorted([
    "pipeline-attempts",
    "pipeline-book-packages",
    "pipeline-chapterflow",
    "pipeline-logs",
    "pipeline-state",
    "repo-root-state (forbidden shadow)",
  ]));
  assert.equal(
    report.guardedRoots.find((root) => root.name === "pipeline-chapterflow")?.path,
    resolve(PIPELINE_ROOT, ".chapterflow"),
  );
  assert.equal(
    report.guardedRoots.find((root) => root.name === "pipeline-book-packages")?.path,
    resolve(PIPELINE_ROOT, "book-packages"),
  );
  assert.ok(report.guardedRoots.every((root) => root.entryCount >= 1));
  console.log(`V25 BASELINE ${JSON.stringify(report)}`);
});

test("optional measurement placeholder remains explicit", () => {}, {
  skip: "no performance threshold belongs to WP-V4-001",
});

test("owner driver strict compile remains explicit", () => {}, {
  skip: "operator-waived: tracked closed historical drivers fail strict control-flow checking; noCheck forbidden",
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
