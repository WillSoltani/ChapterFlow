import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./verify-shared-ts-closure.mjs", import.meta.url));
const LEDGER_PATH = "scripts/ci/ws7-shared-repair-approvals.json";
const FLAGS = [
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "exactOptionalPropertyTypes",
];
const REPORT_KEYS = [
  "schemaVersion",
  "mode",
  "baseSha",
  "headSha",
  "candidateFlag",
  "baseSharedSourcePaths",
  "headSharedSourcePaths",
  "sharedSetAdded",
  "sharedSetRemoved",
  "diagnosticFiles",
  "sharedFlagDiagnostics",
  "changedFiles",
  "sharedChangedFiles",
  "approvedSharedChangedFiles",
  "unapprovedSharedChangedFiles",
  "approvalEntriesAdded",
  "approvalEntriesModifiedOrRemoved",
  "approvalChainViolations",
  "currentApprovalBlobMismatches",
  "approvalFilesChangedInCandidate",
];

const cleanupRoots = new Set();
test.after(() => {
  for (const root of cleanupRoots) rmSync(root, { recursive: true, force: true });
});

function run(command, args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    assert.fail(
      `${command} ${args.join(" ")} failed (${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result;
}

function git(root, ...args) {
  return run("git", args, root).stdout.trim();
}

function write(root, relativePath, contents) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function writeJson(root, relativePath, value) {
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function commit(root, message) {
  git(root, "add", "-A");
  git(root, "commit", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeRecord({
  changeId,
  flag,
  repairedContents,
  supersedesRecordId = null,
  recordPath = "app/shared.ts",
  purpose = flag === null ? "shared-maintenance" : "ws7-flag-preparation",
  repairedBlobSha256 = sha256(repairedContents),
}) {
  const body = {
    changeId,
    purpose,
    flag,
    path: recordPath,
    appOwner: "app-security-owner",
    bookOwner: "book-v25-owner",
    supersedesRecordId,
    repairedBlobSha256,
    evidenceRefs: ["evidence/hermetic-shared-consumer-gates.json"],
  };
  return {
    recordId: sha256(JSON.stringify(canonicalize(body))),
    ...body,
  };
}

function baseCompilerOptions() {
  return {
    target: "ES2022",
    module: "CommonJS",
    moduleResolution: "Node",
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  };
}

function installSplitConfigs(root, enabledFlags = []) {
  const advanced = Object.fromEntries(enabledFlags.map((flag) => [flag, true]));
  writeJson(root, "tsconfig.base.json", { compilerOptions: baseCompilerOptions() });
  writeJson(root, "tsconfig.surface.json", {
    extends: "./tsconfig.base.json",
    include: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    exclude: ["node_modules"],
  });
  writeJson(root, "tsconfig.app.json", {
    extends: "./tsconfig.base.json",
    compilerOptions: advanced,
    include: ["app/**/*.ts", "app/**/*.tsx", "app/**/*.mts", "app/**/*.cts"],
    exclude: ["scripts/book/**", "node_modules"],
  });
  writeJson(root, "tsconfig.book.json", {
    extends: "./tsconfig.base.json",
    include: ["scripts/book/**/*.ts", "scripts/book/**/*.tsx", "scripts/book/**/*.mts", "scripts/book/**/*.cts"],
    exclude: ["node_modules"],
  });
  writeJson(root, "tsconfig.json", { extends: "./tsconfig.app.json" });
}

function setAppFlags(root, enabledFlags) {
  const config = readJson(root, "tsconfig.app.json");
  config.compilerOptions = Object.fromEntries(enabledFlags.map((flag) => [flag, true]));
  writeJson(root, "tsconfig.app.json", config);
}

function createFixture({ unsafeShared = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "shared-ts-closure-"));
  cleanupRoots.add(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Shared Closure Fixture");

  const sharedContents = unsafeShared
    ? "export function first(values: string[]): string { return values[0].toUpperCase(); }\n"
    : "export function first(values: string[]): string { return values[0] ?? \"fallback\"; }\n";
  write(root, "app/shared.ts", sharedContents);
  write(root, "app/index.ts", "import { first } from \"./shared\"; export const appValue = first([\"app\"]);\n");
  write(
    root,
    "scripts/book/pipeline.ts",
    "import { first } from \"../../app/shared\"; export const bookValue = first([\"book\"]);\n",
  );
  writeJson(root, "tsconfig.json", {
    compilerOptions: baseCompilerOptions(),
    include: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    exclude: ["node_modules"],
  });
  const preSplit = commit(root, "baseline before project split");

  installSplitConfigs(root);
  const split = commit(root, "split app and book TypeScript projects");
  return { root, preSplit, split, sharedContents };
}

function createTwoPathApprovedFixture() {
  const fixture = createFixture();
  const secondSharedContents =
    "export const second = (values: string[]): string => values.at(0) ?? \"second\";\n";
  write(fixture.root, "app/shared-two.ts", secondSharedContents);
  write(
    fixture.root,
    "app/index.ts",
    "import { first } from \"./shared\"; import { second } from \"./shared-two\"; export const appValue = first([second([\"app\"])]);\n",
  );
  write(
    fixture.root,
    "scripts/book/pipeline.ts",
    "import { first } from \"../../app/shared\"; import { second } from \"../../app/shared-two\"; export const bookValue = first([second([\"book\"])]);\n",
  );
  commit(fixture.root, "add a second shared dependency");

  const firstRecord = makeRecord({
    changeId: "existing-first-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: fixture.sharedContents,
  });
  const secondRecord = makeRecord({
    changeId: "existing-second-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: secondSharedContents,
    recordPath: "app/shared-two.ts",
  });
  writeJson(fixture.root, LEDGER_PATH, {
    schemaVersion: 1,
    records: [firstRecord, secondRecord],
  });
  const approvedBase = commit(fixture.root, "record two existing shared approvals");
  return { ...fixture, approvedBase, firstRecord, secondRecord, secondSharedContents };
}

function invoke(root, args) {
  const reportPath = path.join(root, ".shared-closure-report.json");
  const result = run(
    process.execPath,
    [SCRIPT, ...args, "--report", reportPath],
    root,
    { allowFailure: true },
  );
  assert.ok(
    existsSync(reportPath),
    `verifier did not write its report (status ${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  return { ...result, report, reportText: readFileSync(reportPath, "utf8") };
}

function assertReportShape(report) {
  assert.deepEqual(Object.keys(report), REPORT_KEYS);
  assert.equal(report.schemaVersion, 1);
  for (const field of [
    "sharedSetAdded",
    "sharedSetRemoved",
    "changedFiles",
    "sharedChangedFiles",
    "approvedSharedChangedFiles",
    "unapprovedSharedChangedFiles",
    "approvalEntriesModifiedOrRemoved",
    "approvalChainViolations",
    "currentApprovalBlobMismatches",
    "approvalFilesChangedInCandidate",
  ]) {
    assert.deepEqual(report[field], [...report[field]].sort(), `${field} must be bytewise sorted`);
  }
}

test("reconstructs a pre-split base, infers none, and emits deterministic API-exact JSON", () => {
  const fixture = createFixture();
  const first = invoke(fixture.root, ["--base", fixture.preSplit]);
  const second = invoke(fixture.root, ["--base", fixture.preSplit]);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.report.mode, "none");
  assert.equal(first.report.candidateFlag, null);
  assert.deepEqual(first.report.baseSharedSourcePaths.paths, ["app/shared.ts"]);
  assert.deepEqual(first.report.headSharedSourcePaths.paths, ["app/shared.ts"]);
  assert.deepEqual(first.report.sharedSetAdded, []);
  assert.deepEqual(first.report.sharedSetRemoved, []);
  assert.equal(first.reportText.at(-1), "\n");
  assert.equal(first.reportText, second.reportText);
  assertReportShape(first.report);
});

test("probe-only uses TypeScript diagnostic codes and stops on a shared intersection", () => {
  const fixture = createFixture({ unsafeShared: true });
  const result = invoke(fixture.root, ["--probe-only", "--flag", "noUncheckedIndexedAccess"]);

  assert.equal(result.status, 1);
  assert.equal(result.report.mode, "probe");
  assert.equal(result.report.baseSha, result.report.headSha);
  assert.equal(result.report.candidateFlag, "noUncheckedIndexedAccess");
  assert.deepEqual(result.report.sharedFlagDiagnostics, [
    { path: "app/shared.ts", codes: [2532] },
  ]);
  assert.match(result.stderr, /app\/shared\.ts.*TS2532/s);
});

test("probe-only rejects an exact base instead of silently ignoring CI policy", () => {
  const fixture = createFixture();
  const reportPath = path.join(fixture.root, ".probe-with-base-report.json");
  const result = run(
    process.execPath,
    [
      SCRIPT,
      "--probe-only",
      "--flag",
      "noUncheckedIndexedAccess",
      "--base",
      fixture.split,
      "--report",
      reportPath,
    ],
    fixture.root,
    { allowFailure: true },
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--probe-only cannot be combined with --base/);
  assert.equal(existsSync(reportPath), false);
});

test("none mode rejects an unledgered shared ACMR change", () => {
  const fixture = createFixture();
  write(fixture.root, "app/shared.ts", "export const first = (values: string[]) => values.at(0) ?? \"changed\";\n");
  const head = commit(fixture.root, "change shared source without approval");
  const result = invoke(fixture.root, ["--base", fixture.split]);

  assert.equal(result.report.headSha, head);
  assert.equal(result.report.mode, "none");
  assert.deepEqual(result.report.sharedChangedFiles, ["app/shared.ts"]);
  assert.deepEqual(result.report.unapprovedSharedChangedFiles, ["app/shared.ts"]);
  assert.equal(result.status, 1);
});

test("base/head shared-set union catches an import-removal evasion and drift", () => {
  const fixture = createFixture();
  write(fixture.root, "scripts/book/pipeline.ts", "export const bookValue = \"detached\";\n");
  commit(fixture.root, "remove the book consumer import");
  const result = invoke(fixture.root, ["--base", fixture.split]);

  assert.deepEqual(result.report.baseSharedSourcePaths.paths, ["app/shared.ts"]);
  assert.deepEqual(result.report.headSharedSourcePaths.paths, []);
  assert.deepEqual(result.report.sharedSetRemoved, ["app/shared.ts"]);
  assert.deepEqual(result.report.sharedChangedFiles, []);
  assert.equal(result.status, 1);
});

test("ACMR is PR-relative at the merge base when the supplied base tip has diverged", () => {
  const fixture = createFixture();
  git(fixture.root, "checkout", "-b", "feature", fixture.split);
  write(
    fixture.root,
    "app/index.ts",
    "import { first } from \"./shared\"; export const appValue = first([\"feature\"]);\n",
  );
  const featureHead = commit(fixture.root, "feature changes only an app-only path");

  git(fixture.root, "checkout", "main");
  write(
    fixture.root,
    "app/shared.ts",
    "export function first(values: string[]): string { return values.at(0) ?? \"base-only\"; }\n",
  );
  const divergentBaseTip = commit(fixture.root, "base advances a shared path");
  git(fixture.root, "checkout", "feature");

  const result = invoke(fixture.root, ["--base", divergentBaseTip, "--head", featureHead]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.report.changedFiles, ["app/index.ts"]);
  assert.deepEqual(result.report.sharedChangedFiles, []);
  assert.equal(result.report.baseSha, divergentBaseTip);
  assert.equal(result.report.headSha, featureHead);
});

test("infers one cumulative flag transition and rejects caller policy downgrade", () => {
  const fixture = createFixture();
  setAppFlags(fixture.root, ["noUncheckedIndexedAccess"]);
  commit(fixture.root, "enable first advanced flag");

  const valid = invoke(fixture.root, ["--base", fixture.split]);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.report.mode, "flag");
  assert.equal(valid.report.candidateFlag, "noUncheckedIndexedAccess");
  assert.deepEqual(valid.report.sharedFlagDiagnostics, []);
  assert.deepEqual(valid.report.approvalFilesChangedInCandidate, []);

  const downgraded = invoke(fixture.root, [
    "--base",
    fixture.split,
    "--mode",
    "prepare",
    "--flag",
    "noUncheckedIndexedAccess",
  ]);
  assert.equal(downgraded.report.mode, "flag");
  assert.equal(downgraded.status, 1);
  assert.ok(downgraded.report.approvalChainViolations.some((item) => item.includes("caller mode")));
});

test("fails ambiguous multi-flag transitions and cumulative-flag downgrades", () => {
  const multi = createFixture();
  setAppFlags(multi.root, ["noUncheckedIndexedAccess", "noImplicitReturns"]);
  commit(multi.root, "enable two flags at once");
  const multiResult = invoke(multi.root, ["--base", multi.split]);
  assert.equal(multiResult.status, 1);
  assert.ok(multiResult.report.approvalChainViolations.some((item) => item.includes("multiple flag transitions")));

  const downgrade = createFixture();
  setAppFlags(downgrade.root, ["noUncheckedIndexedAccess"]);
  const enabledBase = commit(downgrade.root, "enable the first flag");
  setAppFlags(downgrade.root, ["noImplicitReturns"]);
  commit(downgrade.root, "drop prior flag while enabling next");
  const downgradeResult = invoke(downgrade.root, ["--base", enabledBase]);
  assert.equal(downgradeResult.status, 1);
  assert.ok(downgradeResult.report.approvalChainViolations.some((item) => item.includes("downgrade")));
});

test("infers prepare only for an exact added approval whose SHA-256 matches the repaired blob", () => {
  const fixture = createFixture();
  const repaired = "export function first(values: string[]): string { return values.at(0) ?? \"prepared\"; }\n";
  write(fixture.root, "app/shared.ts", repaired);
  const record = makeRecord({
    changeId: "prepare-no-unchecked-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: repaired,
  });
  writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records: [record] });
  commit(fixture.root, "prepare one shared source");

  const result = invoke(fixture.root, ["--base", fixture.split]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.mode, "prepare");
  assert.equal(result.report.candidateFlag, "noUncheckedIndexedAccess");
  assert.deepEqual(result.report.approvedSharedChangedFiles, ["app/shared.ts"]);
  assert.deepEqual(result.report.unapprovedSharedChangedFiles, []);
  assert.deepEqual(result.report.approvalEntriesAdded, [record]);
  assert.deepEqual(result.report.currentApprovalBlobMismatches, []);
  assert.deepEqual(result.report.sharedFlagDiagnostics, []);
  assert.deepEqual(result.report.approvalFilesChangedInCandidate, [LEDGER_PATH]);
});

test("fails prepare on a stale repaired blob digest or a non-exact approval path set", () => {
  const fixture = createFixture();
  const repaired = "export const first = (values: string[]) => values.at(0) ?? \"prepared\";\n";
  write(fixture.root, "app/shared.ts", repaired);
  const stale = makeRecord({
    changeId: "prepare-stale-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: repaired,
    repairedBlobSha256: "0".repeat(64),
  });
  writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records: [stale] });
  commit(fixture.root, "add a stale approval digest");

  const result = invoke(fixture.root, ["--base", fixture.split]);
  assert.equal(result.status, 1);
  assert.deepEqual(result.report.currentApprovalBlobMismatches, ["app/shared.ts"]);

  const globFixture = createFixture();
  write(globFixture.root, "app/shared.ts", repaired);
  const globRecord = makeRecord({
    changeId: "prepare-glob-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: repaired,
    recordPath: "app/*.ts",
  });
  writeJson(globFixture.root, LEDGER_PATH, { schemaVersion: 1, records: [globRecord] });
  commit(globFixture.root, "try to approve a shared directory glob");
  const globResult = invoke(globFixture.root, ["--base", globFixture.split]);
  assert.equal(globResult.status, 1);
  assert.deepEqual(globResult.report.unapprovedSharedChangedFiles, ["app/shared.ts"]);
  assert.ok(
    globResult.report.approvalChainViolations.some((item) => item.includes("exact TS-family repository path")),
  );
});

test("allows a later same-path repair only through an immutable append-only supersession", () => {
  const fixture = createFixture();
  const firstContents = "export const first = (values: string[]) => values.at(0) ?? \"first\";\n";
  write(fixture.root, "app/shared.ts", firstContents);
  const first = makeRecord({
    changeId: "prepare-no-unchecked-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: firstContents,
  });
  writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records: [first] });
  setAppFlags(fixture.root, FLAGS.slice(0, 3));
  const preparedBase = commit(fixture.root, "existing approval and cumulative flags");

  const secondContents = "export const first = (values: string[]) => values.at(0)?.trim() ?? \"second\";\n";
  write(fixture.root, "app/shared.ts", secondContents);
  const second = makeRecord({
    changeId: "prepare-exact-optional-001",
    flag: "exactOptionalPropertyTypes",
    repairedContents: secondContents,
    supersedesRecordId: first.recordId,
  });
  writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records: [first, second] });
  commit(fixture.root, "append a valid superseding approval");

  const result = invoke(fixture.root, ["--base", preparedBase]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.report.mode, "prepare");
  assert.equal(result.report.candidateFlag, "exactOptionalPropertyTypes");
  assert.deepEqual(result.report.approvalEntriesAdded, [second]);
  assert.deepEqual(result.report.approvalEntriesModifiedOrRemoved, []);
  assert.deepEqual(result.report.currentApprovalBlobMismatches, []);
});

test("rejects ledger deletion, rewritten history, and multiple current leaves", () => {
  const deleted = createFixture();
  const record = makeRecord({
    changeId: "existing-approval-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: deleted.sharedContents,
  });
  writeJson(deleted.root, LEDGER_PATH, { schemaVersion: 1, records: [record] });
  const ledgerBase = commit(deleted.root, "add existing approval ledger");
  unlinkSync(path.join(deleted.root, LEDGER_PATH));
  commit(deleted.root, "delete approval history");
  const deletion = invoke(deleted.root, ["--base", ledgerBase]);
  assert.equal(deletion.status, 1);
  assert.deepEqual(deletion.report.approvalEntriesModifiedOrRemoved, [record.recordId]);
  assert.deepEqual(deletion.report.approvalFilesChangedInCandidate, [LEDGER_PATH]);

  const branched = createFixture();
  const old = makeRecord({
    changeId: "old-approval-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: branched.sharedContents,
  });
  writeJson(branched.root, LEDGER_PATH, { schemaVersion: 1, records: [old] });
  const branchBase = commit(branched.root, "add old approval");
  const changed = "export const first = (values: string[]) => values.at(0) ?? \"branch\";\n";
  write(branched.root, "app/shared.ts", changed);
  const sibling = makeRecord({
    changeId: "bad-branch-001",
    flag: "exactOptionalPropertyTypes",
    repairedContents: changed,
    supersedesRecordId: null,
  });
  writeJson(branched.root, LEDGER_PATH, { schemaVersion: 1, records: [old, sibling] });
  commit(branched.root, "append an unlinked sibling leaf");
  const branch = invoke(branched.root, ["--base", branchBase]);
  assert.equal(branch.status, 1);
  assert.ok(branch.report.approvalChainViolations.some((item) => item.includes("multiple current leaves")));
});

test("rejects an unversioned bare-array ledger and preserves candidateFlag null on malformed records", () => {
  const fixture = createFixture();
  const record = makeRecord({
    changeId: "bare-array-001",
    flag: null,
    repairedContents: fixture.sharedContents,
  });
  writeJson(fixture.root, LEDGER_PATH, [record]);
  commit(fixture.root, "add an unversioned ledger array");
  const bare = invoke(fixture.root, ["--base", fixture.split]);
  assert.equal(bare.status, 1);
  assert.ok(bare.report.approvalChainViolations.some((item) => item.includes("bare arrays are forbidden")));

  const malformed = createFixture();
  writeJson(malformed.root, LEDGER_PATH, {
    schemaVersion: 1,
    records: [{ recordId: "f".repeat(64), changeId: "malformed-001", path: "app/shared.ts" }],
  });
  commit(malformed.root, "add a malformed approval record");
  const malformedResult = invoke(malformed.root, ["--base", malformed.split]);
  assert.equal(malformedResult.status, 1);
  assert.ok(Object.hasOwn(malformedResult.report, "candidateFlag"));
  assert.equal(malformedResult.report.candidateFlag, null);
});

test("preparation rejects duplicate approvals and candidate-local supersession for one changed path", () => {
  const fixture = createFixture();
  const existing = makeRecord({
    changeId: "existing-shared-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: fixture.sharedContents,
  });
  writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records: [existing] });
  const approvedBase = commit(fixture.root, "record the existing shared leaf");

  const intermediateContents =
    "export const first = (values: string[]): string => values.at(0) ?? \"intermediate\";\n";
  const finalContents =
    "export const first = (values: string[]): string => values.at(0)?.trim() ?? \"final\";\n";
  write(fixture.root, "app/shared.ts", finalContents);
  const firstAdded = makeRecord({
    changeId: "duplicate-path-prepare-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: intermediateContents,
    supersedesRecordId: existing.recordId,
  });
  const secondAdded = makeRecord({
    changeId: "duplicate-path-prepare-001",
    flag: "noUncheckedIndexedAccess",
    repairedContents: finalContents,
    supersedesRecordId: firstAdded.recordId,
  });
  writeJson(fixture.root, LEDGER_PATH, {
    schemaVersion: 1,
    records: [existing, firstAdded, secondAdded],
  });
  commit(fixture.root, "try to chain two candidate approvals for one shared change");

  const result = invoke(fixture.root, ["--base", approvedBase]);
  assert.equal(result.status, 1);
  assert.ok(
    result.report.approvalChainViolations.some((item) =>
      item.includes("exactly one added approval record per shared changed path"),
    ),
  );
  assert.ok(
    result.report.approvalChainViolations.some((item) =>
      item.includes("duplicate added approval path: app/shared.ts"),
    ),
  );
  assert.ok(
    result.report.approvalChainViolations.some((item) =>
      item.includes("must supersede the base ledger current leaf"),
    ),
  );
});

test("approval ledger preserves the complete base array as an identical ordered prefix", () => {
  const results = [];
  for (const variant of ["reordered", "inserted"]) {
    const fixture = createTwoPathApprovedFixture();
    const repaired =
      "export const first = (values: string[]): string => values.at(0)?.trim() ?? \"ordered\";\n";
    write(fixture.root, "app/shared.ts", repaired);
    const added = makeRecord({
      changeId: `ordered-prefix-${variant}-001`,
      flag: "noUncheckedIndexedAccess",
      repairedContents: repaired,
      supersedesRecordId: fixture.firstRecord.recordId,
    });
    const records =
      variant === "reordered"
        ? [fixture.secondRecord, fixture.firstRecord, added]
        : [fixture.firstRecord, added, fixture.secondRecord];
    writeJson(fixture.root, LEDGER_PATH, { schemaVersion: 1, records });
    commit(fixture.root, `${variant} base approval history while appending a repair`);
    results.push(invoke(fixture.root, ["--base", fixture.approvedBase]));
  }

  for (const result of results) {
    assert.equal(result.status, 1);
    assert.ok(
      result.report.approvalChainViolations.some((item) =>
        item.includes("complete base record array as an identical ordered prefix"),
      ),
    );
  }
});
