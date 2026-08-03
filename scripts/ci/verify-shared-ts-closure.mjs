#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ADVANCED_FLAGS = [
  "noUncheckedIndexedAccess",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "exactOptionalPropertyTypes",
];
const LEDGER_PATH = "scripts/ci/ws7-shared-repair-approvals.json";
const TS_FAMILY_RE = /(?:^|\.)[cm]?tsx?$/i;
const HEX_64_RE = /^[0-9a-f]{64}$/;
const VALID_MODES = new Set(["none", "prepare", "flag"]);

function bytewiseSort(values) {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function uniqueSorted(values) {
  return bytewiseSort(new Set(values));
}

function normalizeSlashes(value) {
  return value.replaceAll(path.sep, "/");
}

function relativeToRepo(root, candidate) {
  const relative = normalizeSlashes(path.relative(root, path.resolve(candidate)));
  if (relative === "" || relative === ".") return "";
  if (relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) return null;
  return relative;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pathSetSummary(paths) {
  const sorted = uniqueSorted(paths);
  return {
    fileCount: sorted.length,
    sortedPathSha256: sha256(sorted.join("\n")),
    paths: sorted,
  };
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

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function runGit(root, args, { encoding = "utf8", allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  }
  return result;
}

function resolveRevision(root, revision) {
  return runGit(root, ["rev-parse", "--verify", `${revision}^{commit}`]).stdout.trim();
}

class GitSnapshot {
  constructor(root, revision) {
    this.root = path.resolve(root);
    this.sha = resolveRevision(this.root, revision);
    const treeOutput = runGit(
      this.root,
      ["ls-tree", "-r", "-z", "--name-only", this.sha],
      { encoding: "buffer" },
    ).stdout;
    this.files = new Set(
      treeOutput
        .toString("utf8")
        .split("\0")
        .filter(Boolean)
        .map((entry) => normalizeSlashes(entry)),
    );
    this.blobCache = new Map();
    this.directoryEntries = new Map();
    this.#indexDirectories();
  }

  #indexDirectories() {
    const ensure = (directory) => {
      if (!this.directoryEntries.has(directory)) {
        this.directoryEntries.set(directory, { files: new Set(), directories: new Set() });
      }
      return this.directoryEntries.get(directory);
    };
    ensure("");
    for (const file of this.files) {
      const segments = file.split("/");
      const fileName = segments.pop();
      let directory = "";
      for (const segment of segments) {
        ensure(directory).directories.add(segment);
        directory = directory ? `${directory}/${segment}` : segment;
        ensure(directory);
      }
      ensure(directory).files.add(fileName);
    }
  }

  has(relativePath) {
    return this.files.has(normalizeSlashes(relativePath));
  }

  readBlob(relativePath) {
    const normalized = normalizeSlashes(relativePath);
    if (!this.files.has(normalized)) return undefined;
    if (!this.blobCache.has(normalized)) {
      const result = runGit(this.root, ["show", `${this.sha}:${normalized}`], {
        encoding: "buffer",
        allowFailure: true,
      });
      if (result.status !== 0) return undefined;
      this.blobCache.set(normalized, result.stdout);
    }
    return this.blobCache.get(normalized);
  }

  #repoRelative(fileName) {
    return relativeToRepo(this.root, fileName);
  }

  #usesLiveFileSystem(fileName, relative) {
    return relative === null || relative === "node_modules" || relative?.startsWith("node_modules/");
  }

  readFile(fileName) {
    const relative = this.#repoRelative(fileName);
    if (this.#usesLiveFileSystem(fileName, relative)) return ts.sys.readFile(fileName);
    if (relative === "") return undefined;
    const blob = this.readBlob(relative);
    return blob?.toString("utf8");
  }

  fileExists(fileName) {
    const relative = this.#repoRelative(fileName);
    if (this.#usesLiveFileSystem(fileName, relative)) return ts.sys.fileExists(fileName);
    return relative !== "" && this.files.has(relative);
  }

  directoryExists(directoryName) {
    const relative = this.#repoRelative(directoryName);
    if (this.#usesLiveFileSystem(directoryName, relative)) return ts.sys.directoryExists?.(directoryName) ?? false;
    if (relative === "") return true;
    return this.directoryEntries.has(relative);
  }

  getDirectories(directoryName) {
    const relative = this.#repoRelative(directoryName);
    if (this.#usesLiveFileSystem(directoryName, relative)) return ts.sys.getDirectories(directoryName);
    const entries = this.directoryEntries.get(relative ?? "");
    if (!entries) return [];
    const directories = [...entries.directories];
    if (relative === "" && ts.sys.directoryExists(path.join(this.root, "node_modules"))) {
      directories.push("node_modules");
    }
    return uniqueSorted(directories).map((entry) => path.join(directoryName, entry));
  }

  getFileSystemEntries(directoryName) {
    const relative = this.#repoRelative(directoryName);
    if (this.#usesLiveFileSystem(directoryName, relative)) {
      const files = ts.sys.readDirectory(directoryName, undefined, undefined, ["*"]) ?? [];
      return {
        files: files.map((entry) => path.basename(entry)),
        directories: ts.sys.getDirectories(directoryName).map((entry) => path.basename(entry)),
      };
    }
    const entries = this.directoryEntries.get(relative ?? "");
    if (!entries) return { files: [], directories: [] };
    const directories = [...entries.directories];
    if (relative === "" && ts.sys.directoryExists(path.join(this.root, "node_modules"))) {
      directories.push("node_modules");
    }
    return {
      files: uniqueSorted(entries.files),
      directories: uniqueSorted(directories),
    };
  }

  readDirectory(rootDir, extensions, excludes, includes, depth) {
    return ts.matchFiles(
      path.resolve(rootDir),
      extensions,
      excludes,
      includes,
      true,
      this.root,
      depth,
      (directoryName) => this.getFileSystemEntries(directoryName),
      (candidate) => this.realpath(candidate),
    );
  }

  realpath(fileName) {
    const relative = this.#repoRelative(fileName);
    if (this.#usesLiveFileSystem(fileName, relative)) return ts.sys.realpath?.(fileName) ?? fileName;
    return path.resolve(fileName);
  }
}

function formatConfigDiagnostics(diagnostics) {
  return diagnostics
    .map((diagnostic) => `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`)
    .join("; ");
}

function parseConfig(snapshot, configPath) {
  if (!snapshot.has(configPath)) {
    throw new Error(`${configPath} does not exist at ${snapshot.sha}`);
  }
  const absoluteConfig = path.join(snapshot.root, configPath);
  const readResult = ts.readConfigFile(absoluteConfig, (fileName) => snapshot.readFile(fileName));
  if (readResult.error) throw new Error(formatConfigDiagnostics([readResult.error]));
  const host = {
    useCaseSensitiveFileNames: true,
    readDirectory: (...args) => snapshot.readDirectory(...args),
    fileExists: (fileName) => snapshot.fileExists(fileName),
    readFile: (fileName) => snapshot.readFile(fileName),
    directoryExists: (directoryName) => snapshot.directoryExists(directoryName),
    getDirectories: (directoryName) => snapshot.getDirectories(directoryName),
    realpath: (fileName) => snapshot.realpath(fileName),
    getCurrentDirectory: () => snapshot.root,
    onUnRecoverableConfigFileDiagnostic: () => {},
  };
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    host,
    path.dirname(absoluteConfig),
    undefined,
    absoluteConfig,
  );
  if (parsed.errors.length > 0) throw new Error(formatConfigDiagnostics(parsed.errors));
  return parsed;
}

function createSnapshotCompilerHost(snapshot, options) {
  const host = ts.createCompilerHost(options, true);
  host.readFile = (fileName) => snapshot.readFile(fileName);
  host.fileExists = (fileName) => snapshot.fileExists(fileName);
  host.directoryExists = (directoryName) => snapshot.directoryExists(directoryName);
  host.getDirectories = (directoryName) => snapshot.getDirectories(directoryName);
  host.realpath = (fileName) => snapshot.realpath(fileName);
  host.getCurrentDirectory = () => snapshot.root;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const sourceText = snapshot.readFile(fileName);
    if (sourceText === undefined) {
      onError?.(`Cannot read ${fileName}`);
      return undefined;
    }
    return ts.createSourceFile(
      fileName,
      sourceText,
      languageVersion,
      true,
      ts.getScriptKindFromFileName(fileName),
    );
  };
  return host;
}

function createProgram(snapshot, parsed, optionOverrides = {}) {
  const options = {
    ...parsed.options,
    ...optionOverrides,
    noEmit: true,
    incremental: false,
    composite: false,
    tsBuildInfoFile: undefined,
  };
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options,
    projectReferences: parsed.projectReferences,
    host: createSnapshotCompilerHost(snapshot, options),
  });
}

function repoLocalProgramPaths(snapshot, program) {
  const paths = [];
  for (const sourceFile of program.getSourceFiles()) {
    const relative = relativeToRepo(snapshot.root, sourceFile.fileName);
    if (relative === null || relative === "" || relative.startsWith("node_modules/")) continue;
    paths.push(relative);
  }
  return new Set(paths);
}

function intersect(left, right) {
  return new Set([...left].filter((entry) => right.has(entry)));
}

function deriveSharedClosure(snapshot) {
  let appParsed;
  let appPaths;
  let bookPaths;
  let preSplit = false;

  if (snapshot.has("tsconfig.app.json") && snapshot.has("tsconfig.book.json")) {
    appParsed = parseConfig(snapshot, "tsconfig.app.json");
    const bookParsed = parseConfig(snapshot, "tsconfig.book.json");
    appPaths = repoLocalProgramPaths(snapshot, createProgram(snapshot, appParsed));
    bookPaths = repoLocalProgramPaths(snapshot, createProgram(snapshot, bookParsed));
  } else {
    preSplit = true;
    appParsed = parseConfig(snapshot, "tsconfig.json");
    const oracleProgram = createProgram(snapshot, appParsed);
    const oraclePaths = repoLocalProgramPaths(snapshot, oracleProgram);
    appPaths = new Set([...oraclePaths].filter((entry) => !entry.startsWith("scripts/book/")));
    const bookRootNames = appParsed.fileNames.filter((fileName) => {
      const relative = relativeToRepo(snapshot.root, fileName);
      return relative?.startsWith("scripts/book/");
    });
    const bookParsed = { ...appParsed, fileNames: bookRootNames };
    bookPaths = repoLocalProgramPaths(snapshot, createProgram(snapshot, bookParsed));
  }

  const sharedSourcePaths = uniqueSorted(
    [...intersect(appPaths, bookPaths)].filter(
      (entry) => !entry.startsWith("scripts/book/") && TS_FAMILY_RE.test(entry),
    ),
  );
  const flagState = Object.fromEntries(
    ADVANCED_FLAGS.map((flag) => [flag, appParsed.options[flag] === true]),
  );
  return { sharedSourcePaths, flagState, preSplit };
}

function collectDiagnostics(snapshot, flag) {
  const configPath = snapshot.has("tsconfig.app.json") ? "tsconfig.app.json" : "tsconfig.json";
  const parsed = parseConfig(snapshot, configPath);
  const program = createProgram(snapshot, parsed, { [flag]: true });
  const byPath = new Map();
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (!diagnostic.file) continue;
    const relative = relativeToRepo(snapshot.root, diagnostic.file.fileName);
    if (relative === null || relative === "" || relative.startsWith("node_modules/")) continue;
    if (!byPath.has(relative)) byPath.set(relative, new Set());
    byPath.get(relative).add(diagnostic.code);
  }
  return bytewiseSort(byPath.keys()).map((diagnosticPath) => ({
    path: diagnosticPath,
    codes: [...byPath.get(diagnosticPath)].sort((left, right) => left - right),
  }));
}

function changedPaths(root, baseSha, headSha) {
  if (baseSha === headSha) return [];
  const output = runGit(
    root,
    ["diff", "--name-status", "-z", "--find-renames", "--diff-filter=ACMR", `${baseSha}...${headSha}`, "--"],
    { encoding: "buffer" },
  ).stdout.toString("utf8");
  const tokens = output.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (/^[RC]/.test(status)) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (oldPath) paths.push(normalizeSlashes(oldPath));
      if (newPath) paths.push(normalizeSlashes(newPath));
    } else {
      const changedPath = tokens[index++];
      if (changedPath) paths.push(normalizeSlashes(changedPath));
    }
  }
  return uniqueSorted(paths);
}

function parseLedger(snapshot) {
  if (!snapshot.has(LEDGER_PATH)) {
    return { exists: false, records: [], raw: null, violations: [] };
  }
  const rawBuffer = snapshot.readBlob(LEDGER_PATH);
  const violations = [];
  let parsed;
  try {
    parsed = JSON.parse(rawBuffer.toString("utf8"));
  } catch (error) {
    return {
      exists: true,
      records: [],
      raw: rawBuffer,
      violations: [`${LEDGER_PATH}: invalid JSON (${error.message})`],
    };
  }
  let records;
  if (Array.isArray(parsed)) {
    records = parsed;
    violations.push(`${LEDGER_PATH}: bare arrays are forbidden; expected { schemaVersion: 1, records: [] }`);
  } else if (parsed && typeof parsed === "object" && parsed.schemaVersion === 1 && Array.isArray(parsed.records)) {
    const extraKeys = Object.keys(parsed).filter((key) => key !== "schemaVersion" && key !== "records");
    if (extraKeys.length > 0) {
      violations.push(`${LEDGER_PATH}: unsupported top-level fields: ${bytewiseSort(extraKeys).join(", ")}`);
    }
    records = parsed.records;
  } else {
    records = [];
    violations.push(`${LEDGER_PATH}: expected { schemaVersion: 1, records: [] }`);
  }
  return { exists: true, records, raw: rawBuffer, violations };
}

function isExactRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\")) return false;
  // Literal [ and ] are allowed: Next.js dynamic-route directories ([bookId]) are
  // exact repository paths here — record.path is only ever compared by string
  // equality against git-diff output, never used as a glob or pathspec.
  if (path.posix.isAbsolute(value) || value.endsWith("/") || /[*?{}!]/.test(value)) return false;
  return path.posix.normalize(value) === value && value !== "." && !value.startsWith("../");
}

function validateRecord(record, index) {
  const violations = [];
  const label = typeof record?.recordId === "string" ? record.recordId : `record[${index}]`;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return [`${label}: approval must be an object`];
  }
  const expectedKeys = [
    "recordId",
    "changeId",
    "purpose",
    "flag",
    "path",
    "appOwner",
    "bookOwner",
    "supersedesRecordId",
    "repairedBlobSha256",
    "evidenceRefs",
  ];
  const extraKeys = Object.keys(record).filter((key) => !expectedKeys.includes(key));
  const missingKeys = expectedKeys.filter((key) => !(key in record));
  if (extraKeys.length > 0) violations.push(`${label}: unsupported fields: ${bytewiseSort(extraKeys).join(", ")}`);
  if (missingKeys.length > 0) violations.push(`${label}: missing fields: ${bytewiseSort(missingKeys).join(", ")}`);
  if (typeof record.changeId !== "string" || record.changeId.trim() === "") {
    violations.push(`${label}: changeId must be nonempty`);
  }
  if (!isExactRepositoryPath(record.path) || !TS_FAMILY_RE.test(record.path ?? "")) {
    violations.push(`${label}: path must be one exact TS-family repository path`);
  }
  if (typeof record.appOwner !== "string" || record.appOwner.trim() === "") {
    violations.push(`${label}: appOwner must be nonempty`);
  }
  if (typeof record.bookOwner !== "string" || record.bookOwner.trim() === "") {
    violations.push(`${label}: bookOwner must be nonempty`);
  }
  if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0 || record.evidenceRefs.some((ref) => typeof ref !== "string" || ref.trim() === "")) {
    violations.push(`${label}: evidenceRefs must contain durable references`);
  }
  if (!HEX_64_RE.test(record.repairedBlobSha256 ?? "")) {
    violations.push(`${label}: repairedBlobSha256 must be a lowercase SHA-256`);
  }
  if (record.supersedesRecordId !== null && !HEX_64_RE.test(record.supersedesRecordId ?? "")) {
    violations.push(`${label}: supersedesRecordId must be null or a record SHA-256`);
  }
  if (record.purpose === "ws7-flag-preparation") {
    if (!ADVANCED_FLAGS.includes(record.flag)) violations.push(`${label}: WS7 preparation requires an allowed flag`);
  } else if (record.purpose === "shared-maintenance") {
    if (record.flag !== null) violations.push(`${label}: shared maintenance flag must be null`);
  } else {
    violations.push(`${label}: unsupported purpose`);
  }
  const { recordId, ...body } = record;
  const expectedRecordId = sha256(canonicalJson(body));
  if (recordId !== expectedRecordId) violations.push(`${label}: recordId does not match canonical record content`);
  return violations;
}

function validateApprovalHistory(baseLedger, headLedger, headSnapshot) {
  const violations = [...baseLedger.violations, ...headLedger.violations];
  baseLedger.records.forEach((record, index) => violations.push(...validateRecord(record, index)));
  headLedger.records.forEach((record, index) => violations.push(...validateRecord(record, index)));

  const basePrefixPreserved =
    headLedger.records.length >= baseLedger.records.length &&
    baseLedger.records.every(
      (record, index) => canonicalJson(headLedger.records[index]) === canonicalJson(record),
    );
  if (!basePrefixPreserved) {
    violations.push("approval ledger must preserve the complete base record array as an identical ordered prefix");
  }

  const baseById = new Map();
  for (const record of baseLedger.records) {
    if (baseById.has(record.recordId)) violations.push(`${record.recordId}: duplicate recordId in base ledger`);
    else baseById.set(record.recordId, record);
  }
  const headById = new Map();
  for (const record of headLedger.records) {
    if (headById.has(record.recordId)) violations.push(`${record.recordId}: duplicate recordId in head ledger`);
    else headById.set(record.recordId, record);
  }

  const modifiedOrRemoved = [];
  for (const [recordId, baseRecord] of baseById) {
    const headRecord = headById.get(recordId);
    if (!headRecord || canonicalJson(headRecord) !== canonicalJson(baseRecord)) modifiedOrRemoved.push(recordId);
  }
  const added = headLedger.records
    .filter((record) => !baseById.has(record.recordId))
    .sort((left, right) =>
      String(left.recordId) < String(right.recordId)
        ? -1
        : String(left.recordId) > String(right.recordId)
          ? 1
          : 0,
    );

  const baseSuccessorIds = new Set();
  for (const record of baseById.values()) {
    if (record.supersedesRecordId !== null && baseById.has(record.supersedesRecordId)) {
      baseSuccessorIds.add(record.supersedesRecordId);
    }
  }
  const baseLeavesByPath = new Map();
  for (const record of baseById.values()) {
    if (baseSuccessorIds.has(record.recordId)) continue;
    if (!baseLeavesByPath.has(record.path)) baseLeavesByPath.set(record.path, []);
    baseLeavesByPath.get(record.path).push(record);
  }
  for (const record of added) {
    const baseLeaves = baseLeavesByPath.get(record.path) ?? [];
    if (baseLeaves.length === 0) {
      if (record.supersedesRecordId !== null) {
        violations.push(
          `${record.recordId}: new superseding approval must supersede the base ledger current leaf; ${record.path} has no base ledger current leaf`,
        );
      }
      continue;
    }
    if (baseLeaves.length !== 1 || record.supersedesRecordId !== baseLeaves[0].recordId) {
      const expected = baseLeaves.length === 1 ? baseLeaves[0].recordId : "the sole base ledger current leaf";
      violations.push(
        `${record.recordId}: new superseding approval must supersede the base ledger current leaf ${expected}`,
      );
    }
  }

  const successorIds = new Map();
  for (const record of headById.values()) {
    if (record.supersedesRecordId === null) continue;
    const predecessor = headById.get(record.supersedesRecordId);
    if (!predecessor) {
      violations.push(`${record.recordId}: supersedes missing record ${record.supersedesRecordId}`);
      continue;
    }
    if (predecessor.path !== record.path) {
      violations.push(`${record.recordId}: cross-path supersession from ${predecessor.path} to ${record.path}`);
    }
    if (!successorIds.has(predecessor.recordId)) successorIds.set(predecessor.recordId, []);
    successorIds.get(predecessor.recordId).push(record.recordId);
  }
  for (const [recordId, successors] of successorIds) {
    if (successors.length > 1) {
      violations.push(`${recordId}: multiple superseding records (${bytewiseSort(successors).join(", ")})`);
    }
  }

  for (const record of headById.values()) {
    const seen = new Set();
    let cursor = record;
    while (cursor?.supersedesRecordId !== null && cursor?.supersedesRecordId !== undefined) {
      if (seen.has(cursor.recordId)) {
        violations.push(`${record.recordId}: approval supersession cycle`);
        break;
      }
      seen.add(cursor.recordId);
      cursor = headById.get(cursor.supersedesRecordId);
    }
  }

  const leavesByPath = new Map();
  for (const record of headById.values()) {
    if (successorIds.has(record.recordId)) continue;
    if (!leavesByPath.has(record.path)) leavesByPath.set(record.path, []);
    leavesByPath.get(record.path).push(record);
  }
  const currentBlobMismatches = [];
  for (const [recordPath, leaves] of leavesByPath) {
    if (leaves.length !== 1) {
      violations.push(`${recordPath}: multiple current leaves (${leaves.length})`);
      continue;
    }
    const current = leaves[0];
    const blob = headSnapshot.readBlob(recordPath);
    if (!blob || sha256(blob) !== current.repairedBlobSha256) currentBlobMismatches.push(recordPath);
  }

  return {
    added,
    modifiedOrRemoved: uniqueSorted(modifiedOrRemoved),
    violations: uniqueSorted(violations),
    currentBlobMismatches: uniqueSorted(currentBlobMismatches),
  };
}

function sameBlob(left, right) {
  if (left == null || right == null) return left === right;
  return left.equals(right);
}

function inferPolicy({ baseFlags, headFlags, baseLedger, headLedger, history }) {
  const violations = [];
  const enabled = ADVANCED_FLAGS.filter((flag) => !baseFlags[flag] && headFlags[flag]);
  const disabled = ADVANCED_FLAGS.filter((flag) => baseFlags[flag] && !headFlags[flag]);
  const ledgerChanged = !sameBlob(baseLedger.raw, headLedger.raw);
  let mode = "none";
  let candidateFlag = null;

  if (disabled.length > 0) violations.push(`advanced flag downgrade: ${disabled.join(", ")}`);
  if (enabled.length > 1) violations.push(`multiple flag transitions: ${enabled.join(", ")}`);

  if (enabled.length === 1) {
    mode = "flag";
    candidateFlag = enabled[0];
    if (ledgerChanged) violations.push("flag transition and approval-ledger mutation are ambiguous");
    const candidateIndex = ADVANCED_FLAGS.indexOf(candidateFlag);
    const missingPrior = ADVANCED_FLAGS.slice(0, candidateIndex).filter(
      (flag) => !baseFlags[flag] || !headFlags[flag],
    );
    if (missingPrior.length > 0) {
      violations.push(`candidate flag ${candidateFlag} is missing prior cumulative flags: ${missingPrior.join(", ")}`);
    }
    const laterEnabled = ADVANCED_FLAGS.slice(candidateIndex + 1).filter((flag) => headFlags[flag]);
    if (laterEnabled.length > 0) {
      violations.push(`candidate flag ${candidateFlag} has later flags already enabled: ${laterEnabled.join(", ")}`);
    }
  } else if (history.added.length > 0) {
    mode = "prepare";
    const changeIds = new Set(history.added.map((record) => record.changeId));
    if (changeIds.size !== 1) violations.push("prepare additions must share exactly one changeId");
    const flags = new Set(history.added.map((record) => record.flag));
    if (flags.size !== 1) violations.push("prepare additions must share exactly one target flag");
    else candidateFlag = history.added[0]?.flag ?? null;
    const purposes = new Set(history.added.map((record) => record.purpose));
    if (purposes.size !== 1) violations.push("prepare additions must share one purpose");
    if (candidateFlag !== null && !ADVANCED_FLAGS.includes(candidateFlag)) {
      violations.push("prepare target flag is not allowed");
    }
    if (candidateFlag !== null && (baseFlags[candidateFlag] || headFlags[candidateFlag])) {
      violations.push(`prepare target flag ${candidateFlag} must remain disabled`);
    }
    if (candidateFlag === null && [...purposes][0] !== "shared-maintenance") {
      violations.push("null-flag preparation must be shared maintenance");
    }
    if (candidateFlag !== null && [...purposes][0] !== "ws7-flag-preparation") {
      violations.push("WS7 preparation must use ws7-flag-preparation purpose");
    }
  } else if (ledgerChanged) {
    violations.push("approval-ledger mutation is not a valid append-only preparation");
  }

  if (enabled.length === 0 && disabled.length === 0 && history.added.length === 0 && !ledgerChanged) {
    mode = "none";
    candidateFlag = null;
  }
  return { mode, candidateFlag, violations, ledgerChanged };
}

function parseArguments(argv) {
  const args = {
    base: null,
    head: "HEAD",
    report: "artifacts/typescript/shared-closure-report.json",
    probeOnly: false,
    requestedMode: null,
    requestedFlag: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--probe-only") args.probeOnly = true;
    else if (token === "--base") args.base = argv[++index];
    else if (token === "--head") args.head = argv[++index];
    else if (token === "--report") args.report = argv[++index];
    else if (token === "--mode") args.requestedMode = argv[++index];
    else if (token === "--flag") args.requestedFlag = argv[++index];
    else throw new Error(`unknown argument: ${token}`);
    if (["--base", "--head", "--report", "--mode", "--flag"].includes(token) && argv[index] === undefined) {
      throw new Error(`${token} requires a value`);
    }
  }
  if (args.requestedMode !== null && !VALID_MODES.has(args.requestedMode)) {
    throw new Error(`--mode must be one of ${[...VALID_MODES].join(", ")}`);
  }
  if (args.requestedFlag !== null && !ADVANCED_FLAGS.includes(args.requestedFlag)) {
    throw new Error(`--flag must be one of ${ADVANCED_FLAGS.join(", ")}`);
  }
  if (args.probeOnly && args.requestedFlag === null) throw new Error("--probe-only requires --flag");
  if (args.probeOnly && args.base !== null) throw new Error("--probe-only cannot be combined with --base");
  if (!args.probeOnly && args.base === null) throw new Error("CI/inferred mode requires --base <sha>");
  return args;
}

export function verifySharedTypeScriptClosure({
  root,
  baseRevision,
  headRevision = "HEAD",
  probeOnly = false,
  requestedMode = null,
  requestedFlag = null,
}) {
  const headSnapshot = new GitSnapshot(root, headRevision);
  const baseSnapshot = new GitSnapshot(root, probeOnly ? headSnapshot.sha : baseRevision);
  const baseClosure = deriveSharedClosure(baseSnapshot);
  const headClosure = deriveSharedClosure(headSnapshot);
  const baseShared = new Set(baseClosure.sharedSourcePaths);
  const headShared = new Set(headClosure.sharedSourcePaths);
  const sharedUnion = new Set([...baseShared, ...headShared]);
  const sharedSetAdded = uniqueSorted([...headShared].filter((entry) => !baseShared.has(entry)));
  const sharedSetRemoved = uniqueSorted([...baseShared].filter((entry) => !headShared.has(entry)));
  const changedFiles = probeOnly ? [] : changedPaths(root, baseSnapshot.sha, headSnapshot.sha);
  const sharedChangedFiles = uniqueSorted(changedFiles.filter((entry) => sharedUnion.has(entry)));

  const baseLedger = parseLedger(baseSnapshot);
  const headLedger = parseLedger(headSnapshot);
  const history = validateApprovalHistory(baseLedger, headLedger, headSnapshot);
  const approvalFilesChangedInCandidate = sameBlob(baseLedger.raw, headLedger.raw) ? [] : [LEDGER_PATH];

  let mode;
  let candidateFlag;
  let inferenceViolations = [];
  if (probeOnly) {
    mode = "probe";
    candidateFlag = requestedFlag;
    if (requestedMode !== null) inferenceViolations.push("probe-only cannot accept a caller mode");
  } else {
    const inferred = inferPolicy({
      baseFlags: baseClosure.flagState,
      headFlags: headClosure.flagState,
      baseLedger,
      headLedger,
      history,
    });
    mode = inferred.mode;
    candidateFlag = inferred.candidateFlag;
    inferenceViolations = inferred.violations;
    if (requestedMode !== null && requestedMode !== mode) {
      inferenceViolations.push(`caller mode ${requestedMode} does not match inferred mode ${mode}`);
    }
    if (requestedFlag !== null && requestedFlag !== candidateFlag) {
      inferenceViolations.push(`caller flag ${requestedFlag} does not match inferred candidate ${candidateFlag ?? "null"}`);
    }
  }

  const addedApprovalPathList = history.added
    .map((record) => record.path)
    .filter((entry) => typeof entry === "string");
  const addedApprovalPaths = uniqueSorted(addedApprovalPathList);
  const duplicateAddedApprovalPaths = uniqueSorted(
    addedApprovalPathList.filter((entry, index) => addedApprovalPathList.indexOf(entry) !== index),
  );
  const approvedSharedChangedFiles = mode === "prepare"
    ? uniqueSorted(sharedChangedFiles.filter((entry) => addedApprovalPaths.includes(entry)))
    : [];
  const unapprovedSharedChangedFiles = uniqueSorted(
    sharedChangedFiles.filter((entry) => !approvedSharedChangedFiles.includes(entry)),
  );
  if (mode === "prepare") {
    if (history.added.length !== sharedChangedFiles.length) {
      inferenceViolations.push(
        `prepare requires exactly one added approval record per shared changed path (added: ${history.added.length}; changed: ${sharedChangedFiles.length})`,
      );
    }
    for (const duplicatePath of duplicateAddedApprovalPaths) {
      inferenceViolations.push(`prepare contains duplicate added approval path: ${duplicatePath}`);
    }
    if (canonicalJson(addedApprovalPaths) !== canonicalJson(sharedChangedFiles)) {
      inferenceViolations.push(
        `prepare approval paths must exactly equal shared ACMR paths (approvals: ${addedApprovalPaths.join(", ") || "none"}; changed: ${sharedChangedFiles.join(", ") || "none"})`,
      );
    }
    if (history.modifiedOrRemoved.length > 0) {
      inferenceViolations.push("prepare may not modify or remove historical approval records");
    }
  }
  if (mode === "none" && approvalFilesChangedInCandidate.length > 0) {
    inferenceViolations.push("none mode may not mutate the approval ledger");
  }
  if (mode === "flag" && approvalFilesChangedInCandidate.length > 0) {
    inferenceViolations.push("flag mode may not mutate the approval ledger");
  }

  const diagnosticFiles = candidateFlag === null ? [] : collectDiagnostics(headSnapshot, candidateFlag);
  const sharedFlagDiagnostics = diagnosticFiles.filter((entry) => sharedUnion.has(entry.path));
  const approvalChainViolations = uniqueSorted([...history.violations, ...inferenceViolations]);

  const report = {
    schemaVersion: 1,
    mode,
    baseSha: baseSnapshot.sha,
    headSha: headSnapshot.sha,
    candidateFlag,
    baseSharedSourcePaths: pathSetSummary(baseClosure.sharedSourcePaths),
    headSharedSourcePaths: pathSetSummary(headClosure.sharedSourcePaths),
    sharedSetAdded,
    sharedSetRemoved,
    diagnosticFiles,
    sharedFlagDiagnostics,
    changedFiles,
    sharedChangedFiles,
    approvedSharedChangedFiles,
    unapprovedSharedChangedFiles,
    approvalEntriesAdded: [...history.added].sort((left, right) =>
      left.recordId < right.recordId ? -1 : left.recordId > right.recordId ? 1 : 0,
    ),
    approvalEntriesModifiedOrRemoved: history.modifiedOrRemoved,
    approvalChainViolations,
    currentApprovalBlobMismatches: history.currentBlobMismatches,
    approvalFilesChangedInCandidate,
  };

  let ok =
    sharedSetAdded.length === 0 &&
    sharedSetRemoved.length === 0 &&
    history.modifiedOrRemoved.length === 0 &&
    approvalChainViolations.length === 0 &&
    history.currentBlobMismatches.length === 0;
  if (mode === "probe") ok &&= sharedFlagDiagnostics.length === 0;
  if (mode === "none") {
    ok &&=
      candidateFlag === null &&
      sharedChangedFiles.length === 0 &&
      approvedSharedChangedFiles.length === 0 &&
      unapprovedSharedChangedFiles.length === 0 &&
      approvalFilesChangedInCandidate.length === 0;
  }
  if (mode === "prepare") {
    ok &&=
      history.added.length > 0 &&
      unapprovedSharedChangedFiles.length === 0 &&
      sharedFlagDiagnostics.length === 0;
  }
  if (mode === "flag") {
    ok &&=
      candidateFlag !== null &&
      sharedFlagDiagnostics.length === 0 &&
      sharedChangedFiles.length === 0 &&
      approvedSharedChangedFiles.length === 0 &&
      unapprovedSharedChangedFiles.length === 0 &&
      approvalFilesChangedInCandidate.length === 0;
  }
  return { ok: Boolean(ok), report };
}

function renderHumanSummary(result) {
  const { report, ok } = result;
  const lines = [
    `shared TypeScript closure: ${ok ? "PASS" : "FAIL"}`,
    `mode: ${report.mode}`,
    `candidate flag: ${report.candidateFlag ?? "none"}`,
    `base/head shared paths: ${report.baseSharedSourcePaths.fileCount}/${report.headSharedSourcePaths.fileCount}`,
    `shared changed paths: ${report.sharedChangedFiles.length}`,
    `shared flag diagnostics: ${report.sharedFlagDiagnostics.length}`,
  ];
  for (const diagnostic of report.sharedFlagDiagnostics.slice(0, 50)) {
    lines.push(`  ${diagnostic.path}: ${diagnostic.codes.map((code) => `TS${code}`).join(", ")}`);
  }
  const failureGroups = [
    ["shared set added", report.sharedSetAdded],
    ["shared set removed", report.sharedSetRemoved],
    ["unapproved shared changes", report.unapprovedSharedChangedFiles],
    ["approval records modified/removed", report.approvalEntriesModifiedOrRemoved],
    ["approval-chain violations", report.approvalChainViolations],
    ["current approval blob mismatches", report.currentApprovalBlobMismatches],
  ];
  for (const [label, values] of failureGroups) {
    if (values.length === 0) continue;
    lines.push(`${label}: ${values.length}`);
    for (const value of values.slice(0, 50)) lines.push(`  ${value}`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const root = runGit(process.cwd(), ["rev-parse", "--show-toplevel"]).stdout.trim();
    const result = verifySharedTypeScriptClosure({
      root,
      baseRevision: args.base,
      headRevision: args.head,
      probeOnly: args.probeOnly,
      requestedMode: args.requestedMode,
      requestedFlag: args.requestedFlag,
    });
    const reportPath = path.resolve(root, args.report);
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
    const summary = renderHumanSummary(result);
    (result.ok ? process.stdout : process.stderr).write(summary);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`shared TypeScript closure: ERROR\n${error.stack ?? error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
