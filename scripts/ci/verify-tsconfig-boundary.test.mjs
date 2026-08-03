import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBoundarySets,
  normalizeCompilerListedPath,
  runBoundaryCli,
  serializeBoundaryReport,
  validateAdvancedFlagPolicy,
  validateExceptionContract,
  validateSelectorContract,
} from "./verify-tsconfig-boundary.mjs";

const ADVANCED_FLAGS = [
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "exactOptionalPropertyTypes",
];

const PLANNING_BASE_SHA = "ff0696e08b20f462f050d1df71a71149891ecb06";

const LEGACY_COMPILER_OPTIONS = {
  target: "ES2017",
  lib: ["dom", "dom.iterable", "esnext"],
  allowJs: true,
  skipLibCheck: true,
  strict: true,
  noEmit: true,
  esModuleInterop: true,
  module: "esnext",
  moduleResolution: "bundler",
  resolveJsonModule: true,
  isolatedModules: true,
  jsx: "react-jsx",
  incremental: true,
  plugins: [{ name: "next" }],
  paths: { "@/*": ["./*"] },
};

const LEGACY_INCLUDE = [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  ".next/types/**/*.ts",
  "**/*.mts",
  ".next/dev/types/**/*.ts",
  ".next-chapterflow/types/**/*.ts",
  ".next-chapterflow/dev/types/**/*.ts",
  ".next-review/types/**/*.ts",
  ".next-review/dev/types/**/*.ts",
];

const LEGACY_EXCLUDE = [
  "node_modules",
  "infra/**",
  "cdk.out/**",
  "scripts/book/prompts/*/scratch/**",
  ".next-chapterflow/**",
  ".next-cf-dev/**",
];

function selectorFixture() {
  const selectorContract = {
    compilerOptions: structuredClone(LEGACY_COMPILER_OPTIONS),
    include: [...LEGACY_INCLUDE],
    exclude: [...LEGACY_EXCLUDE],
    filesAbsent: true,
    referencesAbsent: true,
  };

  return {
    manifest: {
      planningBaseSha: PLANNING_BASE_SHA,
      selectorContract,
      advancedFlags: [...ADVANCED_FLAGS],
      advancedFlagPolicy: {
        forbiddenConfigs: [
          "tsconfig.base.json",
          "tsconfig.surface.json",
          "tsconfig.book.json",
        ],
        appConfig: "tsconfig.app.json",
        rootConfig: "tsconfig.json",
      },
    },
    baselineConfig: {
      compilerOptions: structuredClone(LEGACY_COMPILER_OPTIONS),
      include: [...LEGACY_INCLUDE],
      exclude: [...LEGACY_EXCLUDE],
    },
    baseConfig: {
      compilerOptions: structuredClone(LEGACY_COMPILER_OPTIONS),
    },
    surfaceConfig: {
      extends: "./tsconfig.base.json",
      include: [...LEGACY_INCLUDE],
      exclude: [...LEGACY_EXCLUDE],
    },
  };
}

test("boundary set evaluator preserves the oracle union and reports overlap", () => {
  const result = evaluateBoundarySets({
    oraclePaths: [
      "app/page.tsx",
      "lib/shared.ts",
      "scripts/book/pipeline.ts",
      "scripts/book/state/owner-only.mts",
    ],
    appPaths: ["app/page.tsx", "lib/shared.ts"],
    bookPaths: ["lib/shared.ts", "scripts/book/pipeline.ts"],
    trackedBookSourcePaths: [
      "scripts/book/pipeline.ts",
      "scripts/book/state/owner-only.mts",
    ],
    baselineBookSourceExceptions: [],
    approvedPostBaseNonSourceExceptions: [
      "scripts/book/state/owner-only.mts",
    ],
  });

  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.bookOwnedMissing, []);
  assert.deepEqual(result.unapprovedTrackedBookSources, []);
  assert.deepEqual(result.appBookSourceLeaks, []);
  assert.deepEqual(result.overlap, ["lib/shared.ts"]);
  assert.deepEqual(result.trackedBookSourceExceptions, [
    "scripts/book/state/owner-only.mts",
  ]);
});

test("missing app-oracle coverage fails even when neither project sees the path", () => {
  const result = evaluateBoundarySets({
    oraclePaths: ["app/page.tsx", "lib/orphan.ts"],
    appPaths: ["app/page.tsx"],
    bookPaths: [],
    trackedBookSourcePaths: [],
    baselineBookSourceExceptions: [],
    approvedPostBaseNonSourceExceptions: [],
  });

  assert.deepEqual(result.missing, ["lib/orphan.ts"]);
});

test("a book-owned oracle path omitted from the book program fails ownership", () => {
  const result = evaluateBoundarySets({
    oraclePaths: ["scripts/book/pipeline.ts"],
    appPaths: [],
    bookPaths: [],
    trackedBookSourcePaths: ["scripts/book/pipeline.ts"],
    baselineBookSourceExceptions: [],
    approvedPostBaseNonSourceExceptions: [],
  });

  assert.deepEqual(result.bookOwnedMissing, ["scripts/book/pipeline.ts"]);
});

test("every transitive scripts/book compiler entry in the app program fails isolation", () => {
  const result = evaluateBoundarySets({
    oraclePaths: [
      "app/page.tsx",
      "scripts/book/private.ts",
      "scripts/book/runtime.js",
      "scripts/book/config.json",
    ],
    appPaths: [
      "app/page.tsx",
      "scripts/book/private.ts",
      "scripts/book/runtime.js",
      "scripts/book/config.json",
    ],
    bookPaths: [
      "scripts/book/private.ts",
      "scripts/book/runtime.js",
      "scripts/book/config.json",
    ],
    trackedBookSourcePaths: ["scripts/book/private.ts"],
    baselineBookSourceExceptions: [],
    approvedPostBaseNonSourceExceptions: [],
  });

  assert.deepEqual(result.appBookSourceLeaks, [
    "scripts/book/config.json",
    "scripts/book/private.ts",
    "scripts/book/runtime.js",
  ]);
});

test("a future tracked book source cannot disappear through coordinated selectors", () => {
  const futurePath = "scripts/book/prompts/chapterflow-v99/state/new-source.cts";
  const result = evaluateBoundarySets({
    oraclePaths: ["app/page.tsx"],
    appPaths: ["app/page.tsx"],
    bookPaths: [],
    trackedBookSourcePaths: [futurePath],
    baselineBookSourceExceptions: [],
    approvedPostBaseNonSourceExceptions: [],
  });

  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unapprovedTrackedBookSources, [futurePath]);
});

test("selector validation rejects coordinated manifest and surface narrowing", () => {
  const fixture = selectorFixture();
  fixture.manifest.selectorContract.include = ["app/**/*.ts"];
  fixture.surfaceConfig.include = ["app/**/*.ts"];

  const violations = validateSelectorContract(fixture);

  assert.ok(
    violations.some((violation) => violation.includes("planning baseline")),
    violations.join("\n"),
  );
});

test("selector authority rejects coordinated planning-base retargeting and narrowing", () => {
  const fixture = selectorFixture();
  fixture.manifest.planningBaseSha = "1".repeat(40);
  fixture.manifest.selectorContract.include = ["app/**/*.ts"];
  fixture.baselineConfig.include = ["app/**/*.ts"];
  fixture.surfaceConfig.include = ["app/**/*.ts"];

  const violations = validateSelectorContract(fixture);

  assert.ok(
    violations.some((violation) => violation.includes("planning base authority")),
    violations.join("\n"),
  );
  assert.ok(
    violations.some((violation) =>
      violation.includes("selector contract authority"),
    ),
    violations.join("\n"),
  );
});

test("selector contract permits only approved advanced flags in the app config", () => {
  const fixture = selectorFixture();
  fixture.manifest.advancedFlags = [...ADVANCED_FLAGS];
  fixture.manifest.advancedFlagPolicy = {
    forbiddenConfigs: [
      "tsconfig.base.json",
      "tsconfig.surface.json",
      "tsconfig.book.json",
    ],
    appConfig: "tsconfig.app.json",
    rootConfig: "tsconfig.json",
  };
  fixture.appConfig = {
    extends: "./tsconfig.base.json",
    compilerOptions: { noUncheckedIndexedAccess: true },
    include: [...LEGACY_INCLUDE],
    exclude: [...LEGACY_EXCLUDE, "scripts/book/**"],
  };
  fixture.rootConfig = { extends: "./tsconfig.app.json" };

  assert.deepEqual(validateSelectorContract(fixture), []);

  fixture.appConfig.compilerOptions.skipLibCheck = false;
  assert.ok(
    validateSelectorContract(fixture).some((violation) =>
      violation.includes("only WS7-010 advanced compilerOptions"),
    ),
  );
});

test("advanced flags may not leak into base, surface, or book", () => {
  const violations = validateAdvancedFlagPolicy({
    advancedFlags: ADVANCED_FLAGS,
    effectiveCompilerOptionsByConfig: {
      "tsconfig.base.json": { noImplicitReturns: true },
      "tsconfig.surface.json": { noImplicitReturns: true },
      "tsconfig.book.json": { noUncheckedIndexedAccess: true },
    },
  });

  assert.deepEqual(violations, [
    "tsconfig.base.json enables noImplicitReturns",
    "tsconfig.book.json enables noUncheckedIndexedAccess",
    "tsconfig.surface.json enables noImplicitReturns",
  ]);
});

test("root wrapper effective advanced flags must match the app project", () => {
  const violations = validateAdvancedFlagPolicy({
    advancedFlags: ADVANCED_FLAGS,
    forbiddenConfigNames: [
      "tsconfig.base.json",
      "tsconfig.surface.json",
      "tsconfig.book.json",
    ],
    appConfigName: "tsconfig.app.json",
    rootConfigName: "tsconfig.json",
    effectiveCompilerOptionsByConfig: {
      "tsconfig.base.json": {},
      "tsconfig.surface.json": {},
      "tsconfig.book.json": {},
      "tsconfig.app.json": { noUncheckedIndexedAccess: true },
      "tsconfig.json": {},
    },
  });

  assert.deepEqual(violations, [
    "tsconfig.json effective noUncheckedIndexedAccess does not match tsconfig.app.json",
  ]);
});

test("compiler path normalization resolves real paths and rejects an escaped source", () => {
  const repoRoot = "/work/repo";
  assert.equal(
    normalizeCompilerListedPath({
      fileName: "/work/repo/src/index.ts",
      repoRoot,
      realRepoRoot: repoRoot,
      resolveRealPath: () => "/work/repo/src/index.ts",
    }),
    "src/index.ts",
  );

  assert.throws(
    () =>
      normalizeCompilerListedPath({
        fileName: "/work/repo/src/escaped.ts",
        repoRoot,
        realRepoRoot: repoRoot,
        resolveRealPath: () => "/outside/escaped.ts",
      }),
    /outside the repository/u,
  );
});

test("node_modules compiler paths are filtered before realpath resolution", () => {
  assert.equal(
    normalizeCompilerListedPath({
      fileName: "/work/repo/node_modules/typescript/lib/lib.esnext.d.ts",
      repoRoot: "/work/repo",
      realRepoRoot: "/work/repo",
      resolveRealPath: () => {
        throw new Error("node_modules realpath must not be consulted");
      },
    }),
    undefined,
  );
});

test("a source symlink resolving into node_modules is filtered as a dependency", () => {
  assert.equal(
    normalizeCompilerListedPath({
      fileName: "/work/repo/vendor/package-entry.ts",
      repoRoot: "/work/repo",
      realRepoRoot: "/work/repo",
      resolveRealPath: () =>
        "/work/repo/node_modules/package/package-entry.ts",
    }),
    undefined,
  );
});

test("exception contract rejects globs, directories, duplicates, and baseline intersections", () => {
  const violations = validateExceptionContract({
    baselineBookSourceExceptions: [
      "scripts/book/prompts/v24/scratch/legacy.ts",
      "scripts/book/prompts/v24/scratch/legacy.ts",
    ],
    approvedPostBaseNonSourceExceptions: [
      "scripts/book/prompts/v24/state/**",
      "scripts/book/prompts/v24/state/",
      "scripts/book/prompts/v24/state/existing.ts",
    ],
    planningBaselineTrackedPaths: new Set([
      "scripts/book/prompts/v24/state/existing.ts",
    ]),
  });

  assert.ok(violations.some((violation) => violation.includes("duplicate")));
  assert.ok(violations.some((violation) => violation.includes("glob")));
  assert.ok(violations.some((violation) => violation.includes("directory")));
  assert.ok(
    violations.some((violation) => violation.includes("planning baseline")),
  );
});

function boundaryReportFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    selectorContractSha256: "abc",
    projects: {
      oracle: { config: "tsconfig.surface.json", fileCount: 2, sortedPathSha256: "o" },
      app: { config: "tsconfig.app.json", fileCount: 1, sortedPathSha256: "a" },
      book: { config: "tsconfig.book.json", fileCount: 1, sortedPathSha256: "b" },
    },
    missing: ["z.ts", "a.ts"],
    unexpected: [],
    selectorContractViolations: ["z", "a"],
    bookOwnedMissing: [],
    trackedBookSourceExceptions: [],
    unapprovedTrackedBookSources: [],
    appBookSourceLeaks: [],
    advancedFlagPolicyViolations: [],
    overlap: ["shared/z.ts", "shared/a.ts"],
    sharedBookDependencies: {
      fileCount: 2,
      sortedPathSha256: "d",
      paths: ["lib/z.js", "lib/a.ts"],
    },
    sharedSourcePaths: {
      fileCount: 1,
      sortedPathSha256: "s",
      paths: ["lib/a.ts"],
    },
    ...overrides,
  };
}

test("report serialization is byte-stable, path-sorted, and newline terminated", () => {
  const reportA = boundaryReportFixture();
  const reportB = structuredClone(reportA);
  reportB.missing.reverse();
  reportB.selectorContractViolations.reverse();
  reportB.overlap.reverse();
  reportB.sharedBookDependencies.paths.reverse();

  const serializedA = serializeBoundaryReport(reportA);
  const serializedB = serializeBoundaryReport(reportB);

  assert.equal(serializedA, serializedB);
  assert.ok(serializedA.endsWith("\n"));
  const parsed = JSON.parse(serializedA);
  assert.deepEqual(parsed.missing, ["a.ts", "z.ts"]);
  assert.deepEqual(parsed.overlap, ["shared/a.ts", "shared/z.ts"]);
  assert.deepEqual(parsed.sharedBookDependencies.paths, ["lib/a.ts", "lib/z.js"]);
});

test("CLI failure path returns one and prints a missing path in JSON and human output", () => {
  const missingPath = "app/missing.ts";
  const report = boundaryReportFixture({ missing: [missingPath] });
  let stdout = "";
  let stderr = "";

  const exitCode = runBoundaryCli({
    verify: () => ({ report, failed: false }),
    stdout: { write: (chunk) => { stdout += chunk; } },
    stderr: { write: (chunk) => { stderr += chunk; } },
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(JSON.parse(stdout).missing, [missingPath]);
  assert.match(stderr, /missing \(1\):/u);
  assert.match(stderr, /app\/missing\.ts/u);
});
