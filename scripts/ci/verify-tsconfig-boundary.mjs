#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");
const REAL_REPO_ROOT = realpathSync(REPO_ROOT);
const TSC_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.resolve("typescript"))),
  "tsc.js",
);
const CONTRACT_PATH = path.join(
  REPO_ROOT,
  "scripts/ci/tsconfig-boundary-contract.json",
);
const BOOK_PREFIX = "scripts/book/";
const TYPESCRIPT_SOURCE_RE = /\.(?:cts|mts|tsx?|d\.ts)$/u;
const PINNED_PLANNING_BASE_SHA =
  "ff0696e08b20f462f050d1df71a71149891ecb06";
const PINNED_SELECTOR_CONTRACT_SHA256 =
  "895bc52dc1fc01097fd45bdd7c673fdd80153d40bc86c88ba60f9c6493ef9fd6";
const PINNED_BASELINE_EXCEPTION_SHA256 =
  "b266be7bb7fc26249fd4620a81d0cd82e3b388899952f801fc1559414489118d";
// Widened 2026-08-04 from 21 to 43 on explicit owner approval: the 22 scratch/*.ts
// files committed by 96ba28179 (2026-07-12) reach main for the first time via
// PR #450. POST-BASE is the correct list, not baseline — they did not exist at
// PINNED_PLANNING_BASE_SHA, and the verifier rejects a baseline exception that is
// absent from the planning baseline. They are operator one-offs, never project
// sources, and 15 are cited evidence: scratch/major-calibration.ts is named as the
// calibration source in src/critics/majorPolicy.ts in BOTH pipelines, and
// scratch/tiebreak-ch07.ts in docs/v24/STIER-PLAN-2026-07-03.md as where the
// owner-approved majority-of-3 tiebreak lives — so they are approved, not deleted.
// This hash is the second key: the allowlist, tsconfig.book.json's exclusions, and
// this constant must move together, deliberately.
const PINNED_POST_BASE_EXCEPTION_SHA256 =
  "83b5b158853c1527862275ae044eca020b13a9466fc461b74a2035f98eeb9d37";
const WS7_ADVANCED_FLAGS = [
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "exactOptionalPropertyTypes",
];
const ADVANCED_FLAG_POLICY = {
  forbiddenConfigs: [
    "tsconfig.base.json",
    "tsconfig.surface.json",
    "tsconfig.book.json",
  ],
  appConfig: "tsconfig.app.json",
  rootConfig: "tsconfig.json",
};

const REPORT_ARRAY_KEYS = [
  "missing",
  "unexpected",
  "selectorContractViolations",
  "bookOwnedMissing",
  "trackedBookSourceExceptions",
  "unapprovedTrackedBookSources",
  "appBookSourceLeaks",
  "advancedFlagPolicyViolations",
  "overlap",
];
const FAILURE_REPORT_KEYS = [
  "missing",
  "unexpected",
  "selectorContractViolations",
  "bookOwnedMissing",
  "unapprovedTrackedBookSources",
  "appBookSourceLeaks",
  "advancedFlagPolicyViolations",
];

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareBytes);
}

function difference(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return sortedUnique([...left].filter((value) => !rightSet.has(value)));
}

function intersection(left, right) {
  const rightSet = right instanceof Set ? right : new Set(right);
  return sortedUnique([...left].filter((value) => rightSet.has(value)));
}

function union(left, right) {
  return sortedUnique([...left, ...right]);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareBytes)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPaths(paths) {
  return sha256(sortedUnique(paths).join("\n"));
}

function pathSetSummary(paths) {
  const sortedPaths = sortedUnique(paths);
  return {
    fileCount: sortedPaths.length,
    sortedPathSha256: hashPaths(sortedPaths),
    paths: sortedPaths,
  };
}

function projectSummary(config, paths) {
  const sortedPaths = sortedUnique(paths);
  return {
    config,
    fileCount: sortedPaths.length,
    sortedPathSha256: hashPaths(sortedPaths),
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function equalJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function normalizeInputPath(value) {
  return value.replaceAll("\\", "/");
}

function normalizePathList(values) {
  return sortedUnique(values.map(normalizeInputPath));
}

function isTrackedBookSource(repoPath) {
  return repoPath.startsWith(BOOK_PREFIX) && TYPESCRIPT_SOURCE_RE.test(repoPath);
}

export function evaluateBoundarySets({
  oraclePaths,
  appPaths,
  bookPaths,
  trackedBookSourcePaths,
  baselineBookSourceExceptions,
  approvedPostBaseNonSourceExceptions,
}) {
  const rawOracle = normalizePathList(oraclePaths);
  const app = normalizePathList(appPaths);
  const book = normalizePathList(bookPaths);
  const trackedBookSources = normalizePathList(trackedBookSourcePaths);
  const baselineExceptions = new Set(
    normalizePathList(baselineBookSourceExceptions),
  );
  const postBaseExceptions = new Set(
    normalizePathList(approvedPostBaseNonSourceExceptions),
  );
  const requiredOracle = rawOracle.filter(
    (repoPath) => !postBaseExceptions.has(repoPath),
  );
  const projectUnion = union(app, book);
  const bookSet = new Set(book);
  const approvedExceptions = new Set([
    ...baselineExceptions,
    ...postBaseExceptions,
  ]);
  const missingTrackedBookSources = trackedBookSources.filter(
    (repoPath) => !bookSet.has(repoPath),
  );

  return {
    requiredOracle,
    missing: difference(requiredOracle, projectUnion),
    unexpected: difference(projectUnion, requiredOracle),
    bookOwnedMissing: sortedUnique(
      requiredOracle.filter(
        (repoPath) => repoPath.startsWith(BOOK_PREFIX) && !bookSet.has(repoPath),
      ),
    ),
    trackedBookSourceExceptions: sortedUnique(
      missingTrackedBookSources.filter((repoPath) =>
        approvedExceptions.has(repoPath),
      ),
    ),
    unapprovedTrackedBookSources: sortedUnique(
      missingTrackedBookSources.filter(
        (repoPath) => !approvedExceptions.has(repoPath),
      ),
    ),
    appBookSourceLeaks: sortedUnique(
      app.filter((repoPath) => repoPath.startsWith(BOOK_PREFIX)),
    ),
    overlap: intersection(app, book),
  };
}

function validateConfigHasNoSelectors(configName, config, violations) {
  for (const key of ["include", "exclude", "files", "references"]) {
    if (hasOwn(config, key)) {
      violations.push(`${configName} must not declare ${key}`);
    }
  }
}

function validateNoFilesOrReferences(configName, config, violations) {
  for (const key of ["files", "references"]) {
    if (hasOwn(config, key)) {
      violations.push(`${configName} must not declare ${key}`);
    }
  }
}

export function validateSelectorContract({
  manifest,
  baselineConfig,
  baseConfig,
  surfaceConfig,
  appConfig,
  bookConfig,
  rootConfig,
}) {
  const violations = [];
  const contract = manifest.selectorContract;
  const baselineContract = {
    compilerOptions: baselineConfig.compilerOptions,
    include: baselineConfig.include,
    exclude: baselineConfig.exclude,
    filesAbsent: !hasOwn(baselineConfig, "files"),
    referencesAbsent: !hasOwn(baselineConfig, "references"),
  };
  const selectorContractSha256 = sha256(canonicalJson(contract));

  if (manifest.planningBaseSha !== PINNED_PLANNING_BASE_SHA) {
    violations.push(
      `planning base authority mismatch: expected ${PINNED_PLANNING_BASE_SHA}, received ${manifest.planningBaseSha ?? "missing"}`,
    );
  }
  if (selectorContractSha256 !== PINNED_SELECTOR_CONTRACT_SHA256) {
    violations.push(
      `selector contract authority mismatch: expected ${PINNED_SELECTOR_CONTRACT_SHA256}, received ${selectorContractSha256}`,
    );
  }

  if (!equalJson(contract, baselineContract)) {
    violations.push(
      "selector contract does not match the planning baseline tsconfig.json",
    );
  }
  if (!equalJson(manifest.advancedFlags, WS7_ADVANCED_FLAGS)) {
    violations.push(
      "advanced flag list does not match the approved WS7-010 policy",
    );
  }
  if (!equalJson(manifest.advancedFlagPolicy, ADVANCED_FLAG_POLICY)) {
    violations.push(
      "advanced flag config policy does not match the approved WS7-010 policy",
    );
  }

  if (!equalJson(baseConfig.compilerOptions, contract.compilerOptions)) {
    violations.push(
      "tsconfig.base.json compilerOptions do not match the selector contract",
    );
  }
  validateConfigHasNoSelectors("tsconfig.base.json", baseConfig, violations);

  if (surfaceConfig.extends !== "./tsconfig.base.json") {
    violations.push("tsconfig.surface.json must extend ./tsconfig.base.json");
  }
  if (hasOwn(surfaceConfig, "compilerOptions")) {
    violations.push("tsconfig.surface.json must inherit compilerOptions");
  }
  if (!equalJson(surfaceConfig.include, contract.include)) {
    violations.push(
      "tsconfig.surface.json include does not match the selector contract",
    );
  }
  if (!equalJson(surfaceConfig.exclude, contract.exclude)) {
    violations.push(
      "tsconfig.surface.json exclude does not match the selector contract",
    );
  }
  validateNoFilesOrReferences("tsconfig.surface.json", surfaceConfig, violations);

  if (appConfig !== undefined) {
    if (appConfig.extends !== "./tsconfig.base.json") {
      violations.push("tsconfig.app.json must extend ./tsconfig.base.json");
    }
    const appCompilerOptions = appConfig.compilerOptions ?? {};
    if (
      Object.entries(appCompilerOptions).some(
        ([option, value]) =>
          !WS7_ADVANCED_FLAGS.includes(option) || value !== true,
      )
    ) {
      violations.push(
        "tsconfig.app.json may declare only WS7-010 advanced compilerOptions set to true",
      );
    }
    if (!equalJson(appConfig.include, contract.include)) {
      violations.push(
        "tsconfig.app.json include does not match the selector contract",
      );
    }
    const expectedAppExclude = [...contract.exclude, "scripts/book/**"];
    if (!equalJson(appConfig.exclude, expectedAppExclude)) {
      violations.push(
        "tsconfig.app.json exclude must add only scripts/book/** to the selector contract",
      );
    }
    validateNoFilesOrReferences("tsconfig.app.json", appConfig, violations);
  }

  if (bookConfig !== undefined) {
    const expectedBookInclude = [
      "scripts/book/**/*.ts",
      "scripts/book/**/*.tsx",
      "scripts/book/**/*.mts",
      "scripts/book/**/*.cts",
    ];
    const expectedBookExclude = [
      "node_modules",
      "scripts/book/prompts/*/scratch/**",
      ...manifest.approvedPostBaseNonSourceExceptions,
    ];
    if (bookConfig.extends !== "./tsconfig.base.json") {
      violations.push("tsconfig.book.json must extend ./tsconfig.base.json");
    }
    if (hasOwn(bookConfig, "compilerOptions")) {
      violations.push("tsconfig.book.json must inherit compilerOptions");
    }
    if (!equalJson(bookConfig.include, expectedBookInclude)) {
      violations.push(
        "tsconfig.book.json must use the version-agnostic book source selectors",
      );
    }
    if (!equalJson(bookConfig.exclude, expectedBookExclude)) {
      violations.push(
        "tsconfig.book.json exclusions do not match the approved exception contract",
      );
    }
    validateNoFilesOrReferences("tsconfig.book.json", bookConfig, violations);
  }

  if (
    rootConfig !== undefined &&
    !equalJson(rootConfig, { extends: "./tsconfig.app.json" })
  ) {
    violations.push(
      "tsconfig.json must remain a thin wrapper around ./tsconfig.app.json",
    );
  }

  return sortedUnique(violations);
}

export function validateAdvancedFlagPolicy({
  advancedFlags,
  effectiveCompilerOptionsByConfig,
  forbiddenConfigNames = Object.keys(effectiveCompilerOptionsByConfig),
  appConfigName,
  rootConfigName,
}) {
  const violations = [];
  for (const configName of forbiddenConfigNames) {
    const compilerOptions = effectiveCompilerOptionsByConfig[configName] ?? {};
    for (const flag of advancedFlags) {
      if (compilerOptions[flag] === true) {
        violations.push(`${configName} enables ${flag}`);
      }
    }
  }

  if (appConfigName !== undefined && rootConfigName !== undefined) {
    const appOptions = effectiveCompilerOptionsByConfig[appConfigName] ?? {};
    const rootOptions = effectiveCompilerOptionsByConfig[rootConfigName] ?? {};
    for (const flag of advancedFlags) {
      if (Boolean(rootOptions[flag]) !== Boolean(appOptions[flag])) {
        violations.push(
          `${rootConfigName} effective ${flag} does not match ${appConfigName}`,
        );
      }
    }
  }
  return sortedUnique(violations);
}

function validateExceptionPath(groupName, repoPath, violations) {
  if (/[\[\]*?{}]/u.test(repoPath)) {
    violations.push(`${groupName} contains a glob exception: ${repoPath}`);
  }
  if (repoPath.endsWith("/")) {
    violations.push(`${groupName} contains a directory exception: ${repoPath}`);
  }
  if (
    path.posix.isAbsolute(repoPath) ||
    path.posix.normalize(repoPath) !== repoPath ||
    !repoPath.startsWith(BOOK_PREFIX)
  ) {
    violations.push(`${groupName} contains a non-canonical path: ${repoPath}`);
  }
  if (!TYPESCRIPT_SOURCE_RE.test(repoPath)) {
    violations.push(`${groupName} contains a non-TypeScript path: ${repoPath}`);
  }
}

export function validateExceptionContract({
  baselineBookSourceExceptions,
  approvedPostBaseNonSourceExceptions,
  planningBaselineTrackedPaths,
  expectedBaselineExceptionSha256,
  expectedPostBaseExceptionSha256,
}) {
  const violations = [];
  const planningPaths =
    planningBaselineTrackedPaths instanceof Set
      ? planningBaselineTrackedPaths
      : new Set(planningBaselineTrackedPaths);
  const groups = [
    ["baselineBookSourceExceptions", baselineBookSourceExceptions],
    [
      "approvedPostBaseNonSourceExceptions",
      approvedPostBaseNonSourceExceptions,
    ],
  ];

  for (const [groupName, repoPaths] of groups) {
    const seen = new Set();
    for (const repoPath of repoPaths) {
      if (seen.has(repoPath)) {
        violations.push(`${groupName} contains a duplicate: ${repoPath}`);
      }
      seen.add(repoPath);
      validateExceptionPath(groupName, repoPath, violations);
    }
  }

  const allSeen = new Set();
  for (const repoPath of [
    ...baselineBookSourceExceptions,
    ...approvedPostBaseNonSourceExceptions,
  ]) {
    if (allSeen.has(repoPath)) {
      violations.push(`exception groups overlap at duplicate path: ${repoPath}`);
    }
    allSeen.add(repoPath);
  }

  for (const repoPath of baselineBookSourceExceptions) {
    if (!planningPaths.has(repoPath)) {
      violations.push(
        `baseline exception is absent from the planning baseline: ${repoPath}`,
      );
    }
  }
  for (const repoPath of approvedPostBaseNonSourceExceptions) {
    if (planningPaths.has(repoPath)) {
      violations.push(
        `post-base exception intersects the planning baseline: ${repoPath}`,
      );
    }
  }

  if (
    expectedBaselineExceptionSha256 !== undefined &&
    hashPaths(baselineBookSourceExceptions) !== expectedBaselineExceptionSha256
  ) {
    violations.push("baseline exception allowlist differs from the approved set");
  }
  if (
    expectedPostBaseExceptionSha256 !== undefined &&
    hashPaths(approvedPostBaseNonSourceExceptions) !==
      expectedPostBaseExceptionSha256
  ) {
    violations.push("post-base exception allowlist differs from the approved set");
  }

  return sortedUnique(violations);
}

export function serializeBoundaryReport(report) {
  const normalized = structuredClone(report);
  for (const key of REPORT_ARRAY_KEYS) {
    normalized[key] = sortedUnique(normalized[key]);
  }
  normalized.sharedBookDependencies.paths = sortedUnique(
    normalized.sharedBookDependencies.paths,
  );
  normalized.sharedSourcePaths.paths = sortedUnique(
    normalized.sharedSourcePaths.paths,
  );
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

function formatDiagnostic(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function readJsonConfig(configPath) {
  const text = readFileSync(configPath, "utf8");
  const parsed = ts.parseConfigFileTextToJson(configPath, text);
  if (parsed.error !== undefined) {
    throw new Error(
      `cannot parse ${path.basename(configPath)}: ${formatDiagnostic(parsed.error)}`,
    );
  }
  return parsed.config;
}

function parseJsonText(label, text) {
  const parsed = ts.parseConfigFileTextToJson(label, text);
  if (parsed.error !== undefined) {
    throw new Error(`cannot parse ${label}: ${formatDiagnostic(parsed.error)}`);
  }
  return parsed.config;
}

export function normalizeCompilerListedPath({
  fileName,
  repoRoot,
  realRepoRoot,
  resolveRealPath = realpathSync,
}) {
  const absolutePath = path.isAbsolute(fileName)
    ? path.normalize(fileName)
    : path.resolve(repoRoot, fileName);
  const lexicalSegments = absolutePath.split(path.sep);
  if (lexicalSegments.includes("node_modules")) {
    return undefined;
  }

  const resolvedPath = resolveRealPath(absolutePath);
  const resolvedSegments = path.normalize(resolvedPath).split(path.sep);
  if (resolvedSegments.includes("node_modules")) {
    return undefined;
  }
  const relativePath = path.relative(realRepoRoot, resolvedPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `TypeScript listed a source outside the repository: ${fileName}`,
    );
  }
  return relativePath.split(path.sep).join("/");
}

function parseTypeScriptConfig(configName) {
  const configPath = path.join(REPO_ROOT, configName);
  const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
  if (readResult.error !== undefined) {
    throw new Error(
      `cannot read ${configName}: ${formatDiagnostic(readResult.error)}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(
      `cannot resolve ${configName}: ${parsed.errors.map(formatDiagnostic).join("; ")}`,
    );
  }
  return parsed;
}

function runTypeScriptFileList(configName) {
  const configPath = path.join(REPO_ROOT, configName);
  let output;
  try {
    output = execFileSync(
      process.execPath,
      [
        TSC_PATH,
        "--pretty",
        "false",
        "--listFilesOnly",
        "-p",
        configPath,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const status =
      error !== null && typeof error === "object" && "status" in error
        ? error.status
        : "unknown";
    const stderr =
      error !== null && typeof error === "object" && "stderr" in error
        ? String(error.stderr).trim()
        : "";
    throw new Error(
      `${configName} tsc --listFilesOnly exited ${status}${stderr === "" ? "" : `: ${stderr}`}`,
    );
  }

  return sortedUnique(
    output
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((fileName) =>
        normalizeCompilerListedPath({
          fileName,
          repoRoot: REPO_ROOT,
          realRepoRoot: REAL_REPO_ROOT,
        }),
      )
      .filter((repoPath) => repoPath !== undefined),
  );
}

function loadTypeScriptProject(configName) {
  return {
    compilerOptions: parseTypeScriptConfig(configName).options,
    paths: runTypeScriptFileList(configName),
  };
}

function runGit(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readPlanningBaselineConfig(planningBaseSha) {
  return parseJsonText(
    `${planningBaseSha}:tsconfig.json`,
    runGit(["show", `${planningBaseSha}:tsconfig.json`]),
  );
}

function readPlanningBaselineTrackedPaths(planningBaseSha) {
  const output = runGit(
    [
      "ls-tree",
      "-r",
      "-z",
      "--name-only",
      planningBaseSha,
      "--",
      "scripts/book",
    ],
    "buffer",
  );
  return new Set(
    output
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map(normalizeInputPath),
  );
}

function readTrackedBookSourcePaths() {
  const output = runGit(
    ["ls-files", "-z", "--", "scripts/book"],
    "buffer",
  );
  return sortedUnique(
    output
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map(normalizeInputPath)
      .filter(isTrackedBookSource),
  );
}

function validateManifestShape(manifest) {
  if (manifest.schemaVersion !== 1) {
    throw new Error("unsupported tsconfig boundary contract schemaVersion");
  }
  if (!/^[0-9a-f]{40}$/u.test(manifest.planningBaseSha)) {
    throw new Error("planningBaseSha must be a full lowercase Git SHA");
  }
  if (
    manifest.selectorContract === undefined ||
    !Array.isArray(manifest.advancedFlags) ||
    manifest.advancedFlagPolicy === undefined ||
    !Array.isArray(manifest.baselineBookSourceExceptions) ||
    !Array.isArray(manifest.approvedPostBaseNonSourceExceptions)
  ) {
    throw new Error("tsconfig boundary contract is missing required fields");
  }
}

export function runBoundaryVerification() {
  const manifest = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
  validateManifestShape(manifest);

  const baselineConfig = readPlanningBaselineConfig(PINNED_PLANNING_BASE_SHA);
  const planningBaselineTrackedPaths = readPlanningBaselineTrackedPaths(
    PINNED_PLANNING_BASE_SHA,
  );
  const baseConfig = readJsonConfig(path.join(REPO_ROOT, "tsconfig.base.json"));
  const surfaceConfig = readJsonConfig(
    path.join(REPO_ROOT, "tsconfig.surface.json"),
  );
  const appConfig = readJsonConfig(path.join(REPO_ROOT, "tsconfig.app.json"));
  const bookConfig = readJsonConfig(path.join(REPO_ROOT, "tsconfig.book.json"));
  const rootConfig = readJsonConfig(path.join(REPO_ROOT, "tsconfig.json"));

  const selectorContractViolations = [
    ...validateSelectorContract({
      manifest,
      baselineConfig,
      baseConfig,
      surfaceConfig,
      appConfig,
      bookConfig,
      rootConfig,
    }),
    ...validateExceptionContract({
      baselineBookSourceExceptions: manifest.baselineBookSourceExceptions,
      approvedPostBaseNonSourceExceptions:
        manifest.approvedPostBaseNonSourceExceptions,
      planningBaselineTrackedPaths,
      expectedBaselineExceptionSha256: PINNED_BASELINE_EXCEPTION_SHA256,
      expectedPostBaseExceptionSha256: PINNED_POST_BASE_EXCEPTION_SHA256,
    }),
  ];

  const oracleProject = loadTypeScriptProject("tsconfig.surface.json");
  const appProject = loadTypeScriptProject("tsconfig.app.json");
  const bookProject = loadTypeScriptProject("tsconfig.book.json");
  const trackedBookSourcePaths = readTrackedBookSourcePaths();
  const boundarySets = evaluateBoundarySets({
    oraclePaths: oracleProject.paths,
    appPaths: appProject.paths,
    bookPaths: bookProject.paths,
    trackedBookSourcePaths,
    baselineBookSourceExceptions: manifest.baselineBookSourceExceptions,
    approvedPostBaseNonSourceExceptions:
      manifest.approvedPostBaseNonSourceExceptions,
  });
  const sharedBookDependencies = boundarySets.overlap.filter(
    (repoPath) => !repoPath.startsWith(BOOK_PREFIX),
  );
  const sharedSourcePaths = sharedBookDependencies.filter((repoPath) =>
    TYPESCRIPT_SOURCE_RE.test(repoPath),
  );
  const advancedFlagPolicyViolations = validateAdvancedFlagPolicy({
    advancedFlags: manifest.advancedFlags,
    forbiddenConfigNames: manifest.advancedFlagPolicy.forbiddenConfigs,
    appConfigName: manifest.advancedFlagPolicy.appConfig,
    rootConfigName: manifest.advancedFlagPolicy.rootConfig,
    effectiveCompilerOptionsByConfig: {
      "tsconfig.base.json": parseTypeScriptConfig("tsconfig.base.json").options,
      "tsconfig.surface.json": oracleProject.compilerOptions,
      "tsconfig.book.json": bookProject.compilerOptions,
      "tsconfig.app.json": appProject.compilerOptions,
      "tsconfig.json": parseTypeScriptConfig("tsconfig.json").options,
    },
  });

  const report = {
    schemaVersion: 1,
    selectorContractSha256: sha256(canonicalJson(manifest)),
    projects: {
      oracle: projectSummary(
        "tsconfig.surface.json",
        boundarySets.requiredOracle,
      ),
      app: projectSummary("tsconfig.app.json", appProject.paths),
      book: projectSummary("tsconfig.book.json", bookProject.paths),
    },
    missing: boundarySets.missing,
    unexpected: boundarySets.unexpected,
    selectorContractViolations: sortedUnique(selectorContractViolations),
    bookOwnedMissing: boundarySets.bookOwnedMissing,
    trackedBookSourceExceptions: boundarySets.trackedBookSourceExceptions,
    unapprovedTrackedBookSources: boundarySets.unapprovedTrackedBookSources,
    appBookSourceLeaks: boundarySets.appBookSourceLeaks,
    advancedFlagPolicyViolations,
    overlap: boundarySets.overlap,
    sharedBookDependencies: pathSetSummary(sharedBookDependencies),
    sharedSourcePaths: pathSetSummary(sharedSourcePaths),
  };

  const failed = boundaryReportFailed(report);
  return { report, failed };
}

export function boundaryReportFailed(report) {
  return FAILURE_REPORT_KEYS.some((key) => report[key].length > 0);
}

function printFailurePreview(report, stderr) {
  const failureEntries = [
    ["missing", report.missing],
    ["unexpected", report.unexpected],
    ["selector contract", report.selectorContractViolations],
    ["book-owned missing", report.bookOwnedMissing],
    ["unapproved tracked book sources", report.unapprovedTrackedBookSources],
    ["app book-source leaks", report.appBookSourceLeaks],
    ["advanced-flag policy", report.advancedFlagPolicyViolations],
  ];
  for (const [label, values] of failureEntries) {
    if (values.length === 0) {
      continue;
    }
    stderr.write(`${label} (${values.length}):\n`);
    for (const value of values.slice(0, 50)) {
      stderr.write(`  ${value}\n`);
    }
    if (values.length > 50) {
      stderr.write(`  ... ${values.length - 50} more\n`);
    }
  }
}

export function runBoundaryCli({
  verify = runBoundaryVerification,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const { report } = verify();
    const failed = boundaryReportFailed(report);
    stdout.write(serializeBoundaryReport(report));
    if (failed) {
      printFailurePreview(report, stderr);
      return 1;
    } else {
      stderr.write(
        `TypeScript boundary verified: oracle=${report.projects.oracle.fileCount}, app=${report.projects.app.fileCount}, book=${report.projects.book.fileCount}, overlap=${report.overlap.length}\n`,
      );
      return 0;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`TypeScript boundary verification failed closed: ${message}\n`);
    return 1;
  }
}

function main() {
  process.exitCode = runBoundaryCli();
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
