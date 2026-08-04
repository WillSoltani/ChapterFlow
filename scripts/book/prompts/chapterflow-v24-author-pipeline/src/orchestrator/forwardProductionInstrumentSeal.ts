/**
 * Exact portable byte seal for the complete IMP-22 production instrument.
 *
 * The seal deliberately over-binds the implementation: every file under
 * pipeline src/, config/, and the live contract-schema directory, plus the
 * external Rubric-v2 assets used by the fixed gold instrument.  Volatile
 * attempts/results/state are excluded.  A retained self-hashed seal is bound
 * into the role freeze and campaign manifest; live preflight rebuilds this
 * inventory from current bytes before any model call and again at every
 * author/reviewer/gold/final boundary.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashCanonical, sha256Hex } from "../contracts/contractUtil.js";
import { canonicalJson } from "../lib/canonicalJson.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

export const FORWARD_PRODUCTION_INSTRUMENT_SEAL_SCHEMA = "forward-production-instrument-seal-v1" as const;
export const FORWARD_PRODUCTION_INSTRUMENT_SEAL_VERSION = 1 as const;

const DEFAULT_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const PIPELINE_REL = "scripts/book/prompts/chapterflow-v24-author-pipeline";
export const FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH =
  `${PIPELINE_REL}/state/migration-experiments/contracts/imp22/forward-production-instrument-seal.json` as const;
const INVENTORY_ROOTS = [
  `${PIPELINE_REL}/src`,
  `${PIPELINE_REL}/config`,
  `${PIPELINE_REL}/state/migration-experiments/contracts/schemas`,
] as const;
const EXTERNAL_GOLD_ASSETS = [
  ".agents/skills/chapterflow-book-evaluator/references/rubric-v2.md",
  ".agents/skills/chapterflow-book-evaluator/references/book-rater-prompt.md",
  ".agents/skills/chapterflow-book-evaluator/references/scoring-protocol.md",
  ".agents/skills/chapterflow-book-evaluator/references/book-evaluation.schema.json",
  ".agents/skills/chapterflow-book-evaluator/references/adjudication-protocol.md",
  ".agents/skills/chapterflow-book-evaluator/references/adjudicated-book.schema.json",
] as const;
const PIPELINE_RUNTIME_ASSETS = [
  `${PIPELINE_REL}/package.json`,
  `${PIPELINE_REL}/package-lock.json`,
] as const;

export type ForwardProductionInstrumentFileV1 = {
  relativePath: string;
  bytesSha256: string;
  bytes: number;
};

export type ForwardProductionInstrumentSealV1 = {
  schema: typeof FORWARD_PRODUCTION_INSTRUMENT_SEAL_SCHEMA;
  version: typeof FORWARD_PRODUCTION_INSTRUMENT_SEAL_VERSION;
  inventoryPolicy: "all-pipeline-src-config-live-schemas-runtime-lock-plus-fixed-gold-assets-v2";
  files: ForwardProductionInstrumentFileV1[];
  capabilities: { publish: false; promote: false; deploy: false; upload: false; api: false };
  sealSha256: string;
};

export class ForwardProductionInstrumentSealError extends Error {
  readonly classification = "STATE_OR_PROVENANCE" as const;
  constructor(message: string) {
    super(message);
    this.name = "ForwardProductionInstrumentSealError";
  }
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForwardProductionInstrumentSealError(message);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === "object") {
    const object = value as object;
    if (!seen.has(object)) {
      seen.add(object);
      for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
      Object.freeze(object);
    }
  }
  return value;
}

function inventoryFiles(repositoryRoot: string): string[] {
  const root = resolve(repositoryRoot);
  const files: string[] = [];
  const walk = (path: string): void => {
    requireCondition(existsSync(path), `production instrument inventory root is missing: ${relative(root, path)}`);
    for (const name of readdirSync(path).sort()) {
      const child = resolve(path, name);
      const rel = relative(root, child);
      requireCondition(rel.length > 0 && !rel.startsWith(".."), `production instrument path escapes repository root: ${child}`);
      if (statSync(child).isDirectory()) walk(child);
      else files.push(child);
    }
  };
  for (const relPath of INVENTORY_ROOTS) walk(resolve(root, relPath));
  for (const relPath of PIPELINE_RUNTIME_ASSETS) {
    const path = resolve(root, relPath);
    requireCondition(existsSync(path) && statSync(path).isFile(), `production instrument runtime asset is missing: ${relPath}`);
    files.push(path);
  }
  for (const relPath of EXTERNAL_GOLD_ASSETS) {
    const path = resolve(root, relPath);
    requireCondition(existsSync(path) && statSync(path).isFile(), `production instrument external asset is missing: ${relPath}`);
    files.push(path);
  }
  return [...new Set(files)].sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

function coreOf(value: Omit<ForwardProductionInstrumentSealV1, "sealSha256"> | ForwardProductionInstrumentSealV1): Omit<ForwardProductionInstrumentSealV1, "sealSha256"> {
  return {
    schema: value.schema,
    version: value.version,
    inventoryPolicy: value.inventoryPolicy,
    files: value.files,
    capabilities: value.capabilities,
  };
}

export function computeForwardProductionInstrumentSealSha256(
  value: Omit<ForwardProductionInstrumentSealV1, "sealSha256"> | ForwardProductionInstrumentSealV1,
): string {
  return hashCanonical(coreOf(value));
}

export function buildForwardProductionInstrumentSeal(args: {
  repositoryRoot?: string;
} = {}): Readonly<ForwardProductionInstrumentSealV1> {
  const repositoryRoot = resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const files = inventoryFiles(repositoryRoot).map((path) => {
    const bytes = readFileSync(path);
    return { relativePath: relative(repositoryRoot, path), bytesSha256: sha256Hex(bytes), bytes: bytes.length };
  });
  const core: Omit<ForwardProductionInstrumentSealV1, "sealSha256"> = {
    schema: FORWARD_PRODUCTION_INSTRUMENT_SEAL_SCHEMA,
    version: FORWARD_PRODUCTION_INSTRUMENT_SEAL_VERSION,
    inventoryPolicy: "all-pipeline-src-config-live-schemas-runtime-lock-plus-fixed-gold-assets-v2",
    files,
    capabilities: { publish: false, promote: false, deploy: false, upload: false, api: false },
  };
  return deepFreeze({ ...core, sealSha256: computeForwardProductionInstrumentSealSha256(core) });
}

/** Validate both the retained seal's self hash and every current repository
 * byte. A caller cannot bless drift by recomputing only the retained self hash:
 * the campaign manifest and role freeze independently pin sealSha256. */
export function validateForwardProductionInstrumentSeal(
  value: unknown,
  args: { repositoryRoot?: string } = {},
): Readonly<ForwardProductionInstrumentSealV1> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value),
    "production instrument seal must be an object");
  const retained = value as ForwardProductionInstrumentSealV1;
  requireCondition(retained.schema === FORWARD_PRODUCTION_INSTRUMENT_SEAL_SCHEMA
    && retained.version === FORWARD_PRODUCTION_INSTRUMENT_SEAL_VERSION,
  "production instrument seal schema/version mismatch");
  requireCondition(retained.sealSha256 === computeForwardProductionInstrumentSealSha256(retained),
    "production instrument seal self hash mismatch");
  const current = buildForwardProductionInstrumentSeal(args);
  requireCondition(retained.sealSha256 === current.sealSha256
    && hashCanonical(retained.files) === hashCanonical(current.files),
  "production instrument bytes drifted from the retained live seal");
  return deepFreeze(retained);
}

export type ForwardProductionInstrumentSealMaterializationV1 = {
  schema: "forward-production-instrument-seal-materialization-v1";
  outputPath: string;
  sealSha256: string;
  fileCount: number;
  artifactBytesSha256: string;
  written: boolean;
  modelCalls: 0;
  apiCalls: 0;
};

/** Deterministic zero-model materializer. Dry mode computes the exact output
 * path/hash only. `write` atomically emits canonical JSON and immediately
 * re-reads and fully validates it against the current production bytes. */
export function materializeForwardProductionInstrumentSeal(args: {
  repositoryRoot?: string;
  outputPath?: string;
  write?: boolean;
} = {}): ForwardProductionInstrumentSealMaterializationV1 {
  const repositoryRoot = resolve(args.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT);
  const outputPath = resolve(args.outputPath ?? resolve(repositoryRoot, FORWARD_PRODUCTION_INSTRUMENT_SEAL_ARTIFACT_REL_PATH));
  const seal = buildForwardProductionInstrumentSeal({ repositoryRoot });
  const bytes = `${canonicalJson(seal)}\n`;
  if (args.write === true) {
    writeFileAtomic(outputPath, bytes);
    let retained: unknown;
    try { retained = JSON.parse(readFileSync(outputPath, "utf8")); }
    catch (error) { throw new ForwardProductionInstrumentSealError(`cannot read back materialized production seal: ${(error as Error).message}`); }
    const validated = validateForwardProductionInstrumentSeal(retained, { repositoryRoot });
    requireCondition(validated.sealSha256 === seal.sealSha256
      && sha256Hex(readFileSync(outputPath)) === sha256Hex(bytes),
    "materialized production seal read-back differs from canonical bytes");
  }
  return {
    schema: "forward-production-instrument-seal-materialization-v1",
    outputPath,
    sealSha256: seal.sealSha256,
    fileCount: seal.files.length,
    artifactBytesSha256: sha256Hex(bytes),
    written: args.write === true,
    modelCalls: 0,
    apiCalls: 0,
  };
}
