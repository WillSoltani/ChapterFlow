/** Model-free, durable readiness proof for IMP-24 local activation. */

import { spawnSync, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { canonicalJson, hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";
import { IMP24_CERTIFICATION_ARTIFACT_PATHS } from "../bakeoff/migration/imp24InstrumentCertification.js";
import {
  IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
} from "./forwardProductionInstrumentSeal.js";
import {
  IMP24_REQUIRED_BRANCH,
  IMP24_REQUIRED_WORKFLOW_FILE,
  validateImp24ImplementationCiGate,
  type Imp24CheckoutIdentityV1,
  type Imp24ImplementationCiGateV1,
} from "./forwardRoleQualificationCampaignV3.js";

export const IMP24_FULL_SUITE_COMMAND = "CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx tests/run.ts" as const;
export const IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA = "imp24-full-suite-process-log-v1" as const;
export const IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA = "imp24-full-suite-attempt-ledger-v2" as const;
export const IMP24_ACTIVATION_READINESS_PROOF_SCHEMA = "imp24-local-activation-readiness-proof-v2" as const;
export const IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT =
  "scripts/book/prompts/chapterflow-v24-author-pipeline/logs/exec" as const;

const PIPELINE_REL_PATH = "scripts/book/prompts/chapterflow-v24-author-pipeline" as const;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const VERIFIED_READINESS = Symbol("verified-imp24-activation-readiness");
const HARNESS_SUMMARY = /^pass (\d+)  fail (\d+)  xfail\(known defects\) (\d+)  xpass (\d+)  xenv\(env-absent\) (\d+)  skip (\d+)$/gm;

export class ForwardActivationReadinessV2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForwardActivationReadinessV2Error";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardActivationReadinessV2Error(message);
}

function requireSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && SHA256.test(value), `${label} must be a lowercase sha256`);
}

function requireGitSha(value: unknown, label: string): asserts value is string {
  requireCondition(typeof value === "string" && GIT_SHA.test(value), `${label} must be an exact lowercase git SHA`);
}

function parseJson<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new ForwardActivationReadinessV2Error(`${label} is not retained valid JSON at ${path}: ${(error as Error).message}`);
  }
}

function runGit(repositoryRoot: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: resolve(repositoryRoot),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    throw new ForwardActivationReadinessV2Error(`cannot verify activation checkout with git ${args.join(" ")}: ${(error as Error).message}`);
  }
}

function implementationPaths(): string[] {
  return [
    `${PIPELINE_REL_PATH}/src`,
    `${PIPELINE_REL_PATH}/config`,
    `${PIPELINE_REL_PATH}/tests`,
    `${PIPELINE_REL_PATH}/package.json`,
    `${PIPELINE_REL_PATH}/package-lock.json`,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.corpusBundle,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.certificationBinding,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.legacyClosure,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.thresholds,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportJson,
    IMP24_CERTIFICATION_ARTIFACT_PATHS.reportMarkdown,
    "docs/v25/reports/IMP-24_PROTOCOL_DECISION.md",
    IMP24_FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH,
    `${PIPELINE_REL_PATH}/state/migration-experiments/contracts/schemas/reader-experience-model-output-v2.schema.json`,
    `${PIPELINE_REL_PATH}/state/migration-experiments/contracts/schemas/source-integrity-model-output-v2.schema.json`,
    `${PIPELINE_REL_PATH}/state/migration-experiments/contracts/schemas/quiz-integrity-model-output-v2.schema.json`,
    ".agents/skills/chapterflow-book-evaluator/references",
    IMP24_REQUIRED_WORKFLOW_FILE,
  ];
}

function currentCheckout(repositoryRoot: string): Imp24CheckoutIdentityV1 {
  return {
    branch: runGit(repositoryRoot, ["branch", "--show-current"]),
    headSha: runGit(repositoryRoot, ["rev-parse", "HEAD"]),
    implementationClean: runGit(repositoryRoot, [
      "status", "--porcelain=v1", "--untracked-files=all", "--", ...implementationPaths(),
    ]).length === 0,
  };
}

function filesBelow(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (path: string): void => {
    for (const name of readdirSync(path)) {
      const child = resolve(path, name);
      if (statSync(child).isDirectory()) walk(child);
      else out.push(relative(root, child));
    }
  };
  walk(root);
  return out.sort((left, right) => left.localeCompare(right));
}

export type Imp24HarnessSummaryV1 = {
  pass: number;
  fail: number;
  xfailKnownDefects: number;
  xpass: number;
  xenvEnvAbsent: number;
  skip: number;
  summaryLineSha256: string;
};

export type Imp24FullSuiteProcessLogV1 = {
  schema: typeof IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA;
  command: typeof IMP24_FULL_SUITE_COMMAND;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
  spawnError: string | null;
};

export type Imp24FullSuiteAttemptV1 = {
  sequence: number;
  attemptId: string;
  command: typeof IMP24_FULL_SUITE_COMMAND;
  implementationHeadSha: string;
  productionInstrumentSealSha256: string;
  instrumentCertificationSha256: string;
  startedAt: string;
  completedAt: string;
  exitCode: number;
  harnessSummary: Imp24HarnessSummaryV1 | null;
  noLiveRoute: {
    asserted: boolean;
    rootRelPath: typeof IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT;
    filesFound: string[];
    evidenceSha256: string;
  };
  logRelPath: string;
  logBytesSha256: string;
  stdoutBytesSha256: string;
  stderrBytesSha256: string;
  attemptSha256: string;
};

export type Imp24FullSuiteAttemptLedgerV1 = {
  schema: typeof IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA;
  implementationHeadSha: string;
  productionInstrumentSealSha256: string;
  instrumentCertificationSha256: string;
  command: typeof IMP24_FULL_SUITE_COMMAND;
  attempts: Imp24FullSuiteAttemptV1[];
  finalStatus: "PASS" | "FAIL";
  modelCalls: 0;
  apiCalls: 0;
  ledgerSha256: string;
};

function parseHarnessSummary(output: string): Imp24HarnessSummaryV1 | null {
  const matches = [...output.matchAll(HARNESS_SUMMARY)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  const line = match[0];
  return {
    pass: Number(match[1]),
    fail: Number(match[2]),
    xfailKnownDefects: Number(match[3]),
    xpass: Number(match[4]),
    xenvEnvAbsent: Number(match[5]),
    skip: Number(match[6]),
    summaryLineSha256: sha256Hex(line),
  };
}

function sealAttempt(core: Omit<Imp24FullSuiteAttemptV1, "attemptSha256">): Imp24FullSuiteAttemptV1 {
  return { ...core, attemptSha256: hashCanonical(core) };
}

function sealLedger(core: Omit<Imp24FullSuiteAttemptLedgerV1, "ledgerSha256">): Imp24FullSuiteAttemptLedgerV1 {
  return { ...core, ledgerSha256: hashCanonical(core) };
}

function harnessPassed(summary: Imp24HarnessSummaryV1 | null, output: string): boolean {
  return summary !== null
    && summary.pass > 0
    && summary.fail === 0
    && summary.xpass === 0
    && !output.includes("HERMETICITY FAILURE")
    && !output.includes("LEAK GUARD (CHAPTERFLOW_LEAK_GUARD=1)");
}

function validateFullSuiteLedger(args: {
  ledger: Imp24FullSuiteAttemptLedgerV1;
  ledgerPath: string;
  repositoryRoot: string;
  expectedHeadSha: string;
  expectedProductionInstrumentSealSha256: string;
  expectedInstrumentCertificationSha256: string;
  requirePassingFinal: boolean;
}): void {
  const { ledger } = args;
  requireCondition(ledger.schema === IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA,
    "full-suite attempt ledger schema mismatch");
  const { ledgerSha256, ...core } = ledger;
  requireSha(ledgerSha256, "full-suite attempt ledger hash");
  requireCondition(ledgerSha256 === hashCanonical(core), "full-suite attempt ledger self hash drift");
  requireCondition(ledger.command === IMP24_FULL_SUITE_COMMAND,
    "full-suite ledger command differs from the owner-required no-API full suite command");
  requireCondition(ledger.implementationHeadSha === args.expectedHeadSha
      && ledger.productionInstrumentSealSha256 === args.expectedProductionInstrumentSealSha256
      && ledger.instrumentCertificationSha256 === args.expectedInstrumentCertificationSha256,
    "full-suite ledger belongs to another HEAD, production seal, or certification");
  requireCondition(ledger.modelCalls === 0 && ledger.apiCalls === 0,
    "full-suite ledger is not model/API free");
  requireCondition(Array.isArray(ledger.attempts) && ledger.attempts.length > 0,
    "full-suite ledger contains no retained attempt");
  const ledgerDir = dirname(resolve(args.ledgerPath));
  for (let index = 0; index < ledger.attempts.length; index++) {
    const attempt = ledger.attempts[index];
    requireCondition(attempt.sequence === index + 1, "full-suite attempts are not a contiguous, append-only sequence");
    requireCondition(typeof attempt.attemptId === "string" && attempt.attemptId.length > 0,
      `full-suite attempt ${index + 1} has no identity`);
    requireCondition(attempt.command === ledger.command
        && attempt.implementationHeadSha === ledger.implementationHeadSha
        && attempt.productionInstrumentSealSha256 === ledger.productionInstrumentSealSha256
        && attempt.instrumentCertificationSha256 === ledger.instrumentCertificationSha256,
      `full-suite attempt ${index + 1} differs from the frozen command/HEAD/seal/certification`);
    requireCondition(Number.isFinite(Date.parse(attempt.startedAt))
        && Number.isFinite(Date.parse(attempt.completedAt))
        && Date.parse(attempt.completedAt) >= Date.parse(attempt.startedAt),
      `full-suite attempt ${index + 1} has invalid timing evidence`);
    requireCondition(Number.isSafeInteger(attempt.exitCode) && attempt.exitCode >= 0,
      `full-suite attempt ${index + 1} has an invalid exit status`);
    const { attemptSha256, ...attemptCore } = attempt;
    requireSha(attemptSha256, `full-suite attempt ${index + 1} hash`);
    requireCondition(attemptSha256 === hashCanonical(attemptCore),
      `full-suite attempt ${index + 1} self hash drift`);
    const noLiveCore = {
      asserted: attempt.noLiveRoute.asserted,
      rootRelPath: attempt.noLiveRoute.rootRelPath,
      filesFound: attempt.noLiveRoute.filesFound,
    };
    requireCondition(attempt.noLiveRoute.rootRelPath === IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT
        && attempt.noLiveRoute.evidenceSha256 === hashCanonical(noLiveCore),
      `full-suite attempt ${index + 1} no-live-route evidence hash drift`);
    const logPath = resolve(ledgerDir, attempt.logRelPath);
    requireCondition(logPath.startsWith(`${ledgerDir}/`) && existsSync(logPath),
      `full-suite attempt ${index + 1} log is missing or escapes the readiness evidence directory`);
    const logBytes = readFileSync(logPath);
    requireCondition(logBytes.length > 0 && sha256Hex(logBytes) === attempt.logBytesSha256,
      `full-suite attempt ${index + 1} log bytes differ from the retained hash`);
    const processLog = parseJson<Imp24FullSuiteProcessLogV1>(logPath, `full-suite attempt ${index + 1} process log`);
    requireCondition(processLog.schema === IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA
        && processLog.command === IMP24_FULL_SUITE_COMMAND
        && processLog.exitCode === attempt.exitCode,
      `full-suite attempt ${index + 1} process log identity/exit drift`);
    requireCondition(sha256Hex(processLog.stdout) === attempt.stdoutBytesSha256
        && sha256Hex(processLog.stderr) === attempt.stderrBytesSha256,
      `full-suite attempt ${index + 1} stdout/stderr bytes differ from the retained hashes`);
    const parsedSummary = parseHarnessSummary(`${processLog.stdout}\n${processLog.stderr}`);
    requireCondition(hashCanonical(parsedSummary) === hashCanonical(attempt.harnessSummary),
      `full-suite attempt ${index + 1} harness summary is not derived from the retained process log`);
    const passed = processLog.exitCode === 0
      && processLog.signal === null
      && processLog.spawnError === null
      && attempt.noLiveRoute.asserted === true
      && attempt.noLiveRoute.filesFound.length === 0
      && harnessPassed(parsedSummary, `${processLog.stdout}\n${processLog.stderr}`);
    if (index === ledger.attempts.length - 1) {
      requireCondition(ledger.finalStatus === (passed ? "PASS" : "FAIL"),
        "full-suite ledger final status is not derived from its final retained process attempt");
    }
  }
  requireCondition(new Set(ledger.attempts.map((attempt) => attempt.attemptId)).size === ledger.attempts.length,
    "full-suite attempt ledger reuses an attempt identity");
  if (args.requirePassingFinal) {
    requireCondition(ledger.finalStatus === "PASS", "final retained full-suite attempt did not PASS");
  }
  const liveRouteRoot = resolve(args.repositoryRoot, IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT);
  const actualLiveRouteFiles = filesBelow(liveRouteRoot);
  requireCondition(actualLiveRouteFiles.length === 0,
    `full local suite readiness contains live-route evidence: ${actualLiveRouteFiles.join(", ")}`);
}

export type RecordImp24ActivationFullSuiteV2Args = {
  repositoryRoot: string;
  expectedHeadSha: string;
  fullSuiteLedgerPath: string;
  expectedProductionInstrumentSealSha256: string;
  expectedInstrumentCertificationSha256: string;
};

/**
 * The sole production ledger producer. It owns the exact process invocation,
 * timestamps, stdout/stderr capture, exit status, no-live-route inspection,
 * append-only attempt identity, and self hashes; callers cannot attest them.
 */
export function recordImp24ActivationFullSuiteV2(
  args: RecordImp24ActivationFullSuiteV2Args,
): Readonly<Imp24FullSuiteAttemptLedgerV1> {
  requireGitSha(args.expectedHeadSha, "full-suite expected HEAD");
  requireSha(args.expectedProductionInstrumentSealSha256, "full-suite production instrument seal");
  requireSha(args.expectedInstrumentCertificationSha256, "full-suite instrument certification");
  const repositoryRoot = resolve(args.repositoryRoot);
  const checkoutBefore = currentCheckout(repositoryRoot);
  requireCondition(checkoutBefore.branch === IMP24_REQUIRED_BRANCH
      && checkoutBefore.headSha === args.expectedHeadSha
      && checkoutBefore.implementationClean,
    "full-suite runner requires the exact clean feat/v25-pipeline-live implementation HEAD");
  const liveRouteRoot = resolve(repositoryRoot, IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT);
  requireCondition(filesBelow(liveRouteRoot).length === 0,
    "full-suite runner refuses pre-existing live-route files");

  const ledgerPath = resolve(args.fullSuiteLedgerPath);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  let attempts: Imp24FullSuiteAttemptV1[] = [];
  if (existsSync(ledgerPath)) {
    const prior = parseJson<Imp24FullSuiteAttemptLedgerV1>(ledgerPath, "prior full-suite attempt ledger");
    validateFullSuiteLedger({
      ledger: prior,
      ledgerPath,
      repositoryRoot,
      expectedHeadSha: args.expectedHeadSha,
      expectedProductionInstrumentSealSha256: args.expectedProductionInstrumentSealSha256,
      expectedInstrumentCertificationSha256: args.expectedInstrumentCertificationSha256,
      requirePassingFinal: false,
    });
    attempts = [...prior.attempts];
  }

  const sequence = attempts.length + 1;
  const startedAt = new Date().toISOString();
  const spawned = spawnSync("npx", ["tsx", "tests/run.ts"], {
    cwd: resolve(repositoryRoot, PIPELINE_REL_PATH),
    encoding: "utf8",
    env: { ...process.env, CHAPTERFLOW_NO_API_CODEX_QC: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  const exitCode = spawned.status ?? 127;
  const stdout = spawned.stdout ?? "";
  const stderr = spawned.stderr ?? "";
  const processLog: Imp24FullSuiteProcessLogV1 = {
    schema: IMP24_FULL_SUITE_PROCESS_LOG_SCHEMA,
    command: IMP24_FULL_SUITE_COMMAND,
    stdout,
    stderr,
    exitCode,
    signal: spawned.signal,
    spawnError: spawned.error?.message ?? null,
  };
  const logRelPath = `attempts/full-suite-attempt-${String(sequence).padStart(3, "0")}.process-log.json`;
  const logPath = resolve(dirname(ledgerPath), logRelPath);
  mkdirSync(dirname(logPath), { recursive: true });
  const logBytes = `${canonicalJson(processLog)}\n`;
  writeFileSync(logPath, logBytes, { encoding: "utf8", flag: "wx" });

  const checkoutAfter = currentCheckout(repositoryRoot);
  const liveFiles = filesBelow(liveRouteRoot);
  const noLiveCore = {
    asserted: liveFiles.length === 0,
    rootRelPath: IMP24_FULL_SUITE_NO_LIVE_ROUTE_ROOT,
    filesFound: liveFiles,
  };
  const summary = parseHarnessSummary(`${stdout}\n${stderr}`);
  const attemptCore = {
    sequence,
    attemptId: sha256Hex(`${args.expectedHeadSha}\0${sequence}\0${startedAt}\0${sha256Hex(logBytes)}`),
    command: IMP24_FULL_SUITE_COMMAND,
    implementationHeadSha: args.expectedHeadSha,
    productionInstrumentSealSha256: args.expectedProductionInstrumentSealSha256,
    instrumentCertificationSha256: args.expectedInstrumentCertificationSha256,
    startedAt,
    completedAt,
    exitCode,
    harnessSummary: summary,
    noLiveRoute: { ...noLiveCore, evidenceSha256: hashCanonical(noLiveCore) },
    logRelPath,
    logBytesSha256: sha256Hex(logBytes),
    stdoutBytesSha256: sha256Hex(stdout),
    stderrBytesSha256: sha256Hex(stderr),
  };
  const attempt = sealAttempt(attemptCore);
  const passed = exitCode === 0
    && spawned.signal === null
    && spawned.error === undefined
    && checkoutAfter.branch === IMP24_REQUIRED_BRANCH
    && checkoutAfter.headSha === args.expectedHeadSha
    && checkoutAfter.implementationClean
    && liveFiles.length === 0
    && harnessPassed(summary, `${stdout}\n${stderr}`);
  const ledger = sealLedger({
    schema: IMP24_FULL_SUITE_ATTEMPT_LEDGER_SCHEMA,
    implementationHeadSha: args.expectedHeadSha,
    productionInstrumentSealSha256: args.expectedProductionInstrumentSealSha256,
    instrumentCertificationSha256: args.expectedInstrumentCertificationSha256,
    command: IMP24_FULL_SUITE_COMMAND,
    attempts: [...attempts, attempt],
    finalStatus: passed ? "PASS" : "FAIL",
    modelCalls: 0,
    apiCalls: 0,
  });
  writeFileAtomic(ledgerPath, `${canonicalJson(ledger)}\n`);
  requireCondition(passed, "full local suite attempt was retained but did not produce a clean harness PASS");
  return Object.freeze(ledger);
}

export type Imp24ActivationReadinessProofV2 = {
  schema: typeof IMP24_ACTIVATION_READINESS_PROOF_SCHEMA;
  implementationHeadSha: string;
  implementationCiGateSha256: string;
  implementationCiGateBytesSha256: string;
  fullLocalSuiteLedgerSha256: string;
  fullLocalSuiteLedgerBytesSha256: string;
  productionInstrumentSealSha256: string;
  instrumentCertificationSha256: string;
  fullSuiteAttemptCount: number;
  finalFullSuiteAttemptSha256: string;
  finalHarnessSummarySha256: string;
  noLiveRouteFiles: [];
  modelCalls: 0;
  apiCalls: 0;
  proofSha256: string;
};

export type VerifyImp24ActivationReadinessV2Args = {
  repositoryRoot: string;
  expectedHeadSha: string;
  implementationCiGatePath: string;
  fullSuiteLedgerPath: string;
  expectedProductionInstrumentSealSha256: string;
  expectedInstrumentCertificationSha256: string;
};

export type VerifiedImp24ActivationReadinessV2 = {
  proof: Readonly<Imp24ActivationReadinessProofV2>;
  implementationCiGate: Readonly<Imp24ImplementationCiGateV1>;
  fullSuiteLedger: Readonly<Imp24FullSuiteAttemptLedgerV1>;
  readonly [VERIFIED_READINESS]: true;
};

export function assertVerifiedImp24ActivationReadinessV2(
  value: VerifiedImp24ActivationReadinessV2,
): void {
  requireCondition(value?.[VERIFIED_READINESS] === true,
    "activation readiness was not produced by the retained CI/full-suite verifier");
  const { proofSha256, ...core } = value.proof;
  requireCondition(proofSha256 === hashCanonical(core), "activation readiness proof hash drift");
  requireCondition(value.proof.implementationCiGateSha256 === value.implementationCiGate.gateSha256
      && value.proof.fullLocalSuiteLedgerSha256 === value.fullSuiteLedger.ledgerSha256,
    "activation readiness value was mutated after verification");
}

export function verifyImp24ActivationReadinessV2(
  args: VerifyImp24ActivationReadinessV2Args,
): VerifiedImp24ActivationReadinessV2 {
  requireGitSha(args.expectedHeadSha, "activation expected HEAD");
  requireSha(args.expectedProductionInstrumentSealSha256, "expected production instrument seal");
  requireSha(args.expectedInstrumentCertificationSha256, "expected instrument certification");
  const checkout = currentCheckout(args.repositoryRoot);
  const gatePath = resolve(args.implementationCiGatePath);
  const ledgerPath = resolve(args.fullSuiteLedgerPath);
  const gate = parseJson<Imp24ImplementationCiGateV1>(gatePath, "retained implementation CI gate");
  validateImp24ImplementationCiGate({ gate, expectedHeadSha: args.expectedHeadSha, checkout });
  requireCondition(gate.branch === IMP24_REQUIRED_BRANCH, "retained implementation CI gate branch drift");
  const ledger = parseJson<Imp24FullSuiteAttemptLedgerV1>(ledgerPath, "retained full-suite attempt ledger");
  validateFullSuiteLedger({
    ledger,
    ledgerPath,
    repositoryRoot: args.repositoryRoot,
    expectedHeadSha: args.expectedHeadSha,
    expectedProductionInstrumentSealSha256: args.expectedProductionInstrumentSealSha256,
    expectedInstrumentCertificationSha256: args.expectedInstrumentCertificationSha256,
    requirePassingFinal: true,
  });
  const finalSummary = ledger.attempts.at(-1)!.harnessSummary!;
  const noLiveRouteFiles: [] = [];
  const core = {
    schema: IMP24_ACTIVATION_READINESS_PROOF_SCHEMA,
    implementationHeadSha: args.expectedHeadSha,
    implementationCiGateSha256: gate.gateSha256,
    implementationCiGateBytesSha256: sha256Hex(readFileSync(gatePath)),
    fullLocalSuiteLedgerSha256: ledger.ledgerSha256,
    fullLocalSuiteLedgerBytesSha256: sha256Hex(readFileSync(ledgerPath)),
    productionInstrumentSealSha256: args.expectedProductionInstrumentSealSha256,
    instrumentCertificationSha256: args.expectedInstrumentCertificationSha256,
    fullSuiteAttemptCount: ledger.attempts.length,
    finalFullSuiteAttemptSha256: ledger.attempts.at(-1)!.attemptSha256,
    finalHarnessSummarySha256: hashCanonical(finalSummary),
    noLiveRouteFiles,
    modelCalls: 0 as const,
    apiCalls: 0 as const,
  };
  const proof = Object.freeze({ ...core, proofSha256: hashCanonical(core) });
  const verified = {
    proof,
    implementationCiGate: Object.freeze(gate),
    fullSuiteLedger: Object.freeze(ledger),
  } as VerifiedImp24ActivationReadinessV2;
  Object.defineProperty(verified, VERIFIED_READINESS, { value: true, enumerable: false });
  return Object.freeze(verified);
}
