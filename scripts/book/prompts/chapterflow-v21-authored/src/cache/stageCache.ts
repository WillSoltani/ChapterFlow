import { createHash } from "crypto";
import { copyFileSync, existsSync, readFileSync, readdirSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import type { AgentTier, ProviderName } from "../providers/types.js";
import { CONFIG_SCHEMA_CONTRACT_VERSION, RUNTIME_SCHEMA_CONTRACT_VERSION } from "../runtimeSchemas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_ROOT = resolve(__dirname, "../..");
const PROMPTS_DIR = resolve(PIPELINE_ROOT, "prompts");
const CONFIG_DIR = resolve(PIPELINE_ROOT, "config");

export const STAGE_CACHE_SCHEMA_VERSION = "stage-cache-manifest-v1" as const;
export const STAGE_CACHE_CODE_VERSION = "stage-cache-code-2026-06-23.1" as const;

export type StageArtifactType =
  | "book-brief"
  | "chapter-plan"
  | "chapter"
  | "hook"
  | "breakdown"
  | "example"
  | "quiz"
  | "cards"
  | "implementation-plan"
  | "support";

export type CacheDependencyStatus = "present" | "missing";

export type CacheDependency = {
  id: string;
  hash: string;
  status: CacheDependencyStatus;
  path?: string;
};

export type StageCacheManifest = {
  schemaVersion: typeof STAGE_CACHE_SCHEMA_VERSION;
  schemaVersions: {
    stageCache: typeof STAGE_CACHE_SCHEMA_VERSION;
    runtimeContract: typeof RUNTIME_SCHEMA_CONTRACT_VERSION;
    configContract: typeof CONFIG_SCHEMA_CONTRACT_VERSION;
  };
  artifactType: StageArtifactType;
  artifactId: string;
  outputPath: string;
  outputHash: string;
  inputs: CacheDependency[];
  sourceHash: string | null;
  bookBriefHash: string | null;
  chapterPlanHash: string | null;
  promptHashes: CacheDependency[];
  configHashes: CacheDependency[];
  generator: {
    name: string;
    codeVersion: string;
  };
  provider: {
    tier: AgentTier;
    provider: ProviderName;
    model: string;
  };
  creationStatus: "complete" | "blocked" | "partial";
  createdAt: string;
};

export type ProviderIdentity = StageCacheManifest["provider"];

export type CacheValidationResult =
  | { ok: true; manifest: StageCacheManifest; outputHash: string }
  | { ok: false; reasons: string[]; changedDependencies: string[]; manifest?: StageCacheManifest; outputHash?: string };

export type StageCacheWriteOptions = {
  artifactPath: string;
  artifactType: StageArtifactType;
  artifactId: string;
  inputs: CacheDependency[];
  generatorName: string;
  provider: ProviderIdentity;
  codeVersion?: string;
  createdAt?: string;
  creationStatus?: StageCacheManifest["creationStatus"];
};

export type StageCacheValidateOptions = Omit<StageCacheWriteOptions, "createdAt" | "creationStatus">;

export class StaleCacheError extends Error {
  readonly reasons: string[];
  readonly changedDependencies: string[];

  constructor(artifactId: string, reasons: string[], changedDependencies: string[]) {
    super(
      `stale cache for ${artifactId}: ${reasons.join("; ")}. ` +
        `Regenerate with explicit model generation enabled, or use --force when generation is intentionally allowed.`,
    );
    this.name = "StaleCacheError";
    this.reasons = reasons;
    this.changedDependencies = changedDependencies;
  }
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashJson(value: unknown): string {
  return sha256Text(stableJson(value));
}

export function hashFile(path: string): string | null {
  if (!existsSync(path)) return null;
  return sha256Text(readFileSync(path, "utf8"));
}

export function manifestPathFor(artifactPath: string): string {
  return `${artifactPath}.cache-manifest.json`;
}

export function valueDependency(id: string, value: unknown): CacheDependency {
  return { id, hash: hashJson(value), status: "present" };
}

export function stringDependency(id: string, value: string): CacheDependency {
  return { id, hash: sha256Text(value), status: "present" };
}

export function fileDependency(id: string, path: string | null): CacheDependency {
  if (!path || !existsSync(path)) {
    return { id, hash: "missing", status: "missing", ...(path ? { path } : {}) };
  }
  return { id, hash: hashFile(path) ?? "missing", status: "present", path };
}

export function promptDependencies(promptFileNames: string[]): CacheDependency[] {
  return promptFileNames.map((fileName) => fileDependency(`prompt:${fileName}`, resolve(PROMPTS_DIR, fileName)));
}

export function configDependencies(fileNames = allConfigFiles()): CacheDependency[] {
  return fileNames.map((fileName) => fileDependency(`config:${fileName}`, resolve(CONFIG_DIR, fileName)));
}

export function defaultCacheDependencies(args: {
  providerTier?: AgentTier;
  provider?: ProviderIdentity;
  codeVersion?: string;
  stageSchemaVersion?: string;
} = {}): CacheDependency[] {
  const provider = args.provider ?? currentProviderIdentity(args.providerTier ?? "writer");
  return [
    stringDependency("stage-cache-schema-version", args.stageSchemaVersion ?? STAGE_CACHE_SCHEMA_VERSION),
    stringDependency("runtime-schema-contract-version", RUNTIME_SCHEMA_CONTRACT_VERSION),
    stringDependency("config-schema-contract-version", CONFIG_SCHEMA_CONTRACT_VERSION),
    stringDependency("generator-code-version", args.codeVersion ?? STAGE_CACHE_CODE_VERSION),
    stringDependency("provider", provider.provider),
    stringDependency("model", provider.model),
  ];
}

export function currentProviderIdentity(tier: AgentTier = "writer"): ProviderIdentity {
  const provider = currentProviderName();
  return {
    tier,
    provider,
    model: process.env[`CHAPTERFLOW_${tier.toUpperCase()}_MODEL`] ?? defaultModel(provider, tier),
  };
}

export function writeStageCacheManifest(options: StageCacheWriteOptions): StageCacheManifest {
  const outputHash = hashFile(options.artifactPath);
  if (!outputHash) {
    throw new Error(`Cannot write cache manifest for missing artifact: ${options.artifactPath}`);
  }
  const inputs = normalizeDependencies(options.inputs);
  const manifest: StageCacheManifest = {
    schemaVersion: STAGE_CACHE_SCHEMA_VERSION,
    schemaVersions: {
      stageCache: STAGE_CACHE_SCHEMA_VERSION,
      runtimeContract: RUNTIME_SCHEMA_CONTRACT_VERSION,
      configContract: CONFIG_SCHEMA_CONTRACT_VERSION,
    },
    artifactType: options.artifactType,
    artifactId: options.artifactId,
    outputPath: options.artifactPath,
    outputHash,
    inputs,
    sourceHash: firstPresentHash(inputs, "source:"),
    bookBriefHash: firstPresentHash(inputs, "book-brief"),
    chapterPlanHash: firstPresentHash(inputs, "chapter-plan"),
    promptHashes: inputs.filter((dep) => dep.id.startsWith("prompt:")),
    configHashes: inputs.filter((dep) => dep.id.startsWith("config:")),
    generator: {
      name: options.generatorName,
      codeVersion: options.codeVersion ?? STAGE_CACHE_CODE_VERSION,
    },
    provider: options.provider,
    creationStatus: options.creationStatus ?? "complete",
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
  writeFileAtomic(manifestPathFor(options.artifactPath), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function validateStageCache(options: StageCacheValidateOptions): CacheValidationResult {
  const manifestPath = manifestPathFor(options.artifactPath);
  const outputHash = hashFile(options.artifactPath);
  const reasons: string[] = [];
  const changedDependencies: string[] = [];

  if (!outputHash) {
    return {
      ok: false,
      reasons: [`output missing at ${options.artifactPath}`],
      changedDependencies: ["output"],
    };
  }
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      reasons: [`cache manifest missing at ${manifestPath}`],
      changedDependencies: ["cache-manifest"],
      outputHash,
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      reasons: [`cache manifest unreadable at ${manifestPath}: ${(err as Error).message}`],
      changedDependencies: ["cache-manifest"],
      outputHash,
    };
  }

  const parsed = parseStageCacheManifest(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      reasons: parsed.errors,
      changedDependencies: ["cache-manifest"],
      outputHash,
    };
  }

  const manifest = parsed.manifest;
  if (manifest.artifactType !== options.artifactType) {
    reasons.push(`artifactType changed: manifest ${manifest.artifactType}, current ${options.artifactType}`);
    changedDependencies.push("artifactType");
  }
  if (manifest.artifactId !== options.artifactId) {
    reasons.push(`artifactId changed: manifest ${manifest.artifactId}, current ${options.artifactId}`);
    changedDependencies.push("artifactId");
  }
  if (manifest.outputHash !== outputHash) {
    reasons.push(`output hash changed: manifest ${manifest.outputHash.slice(0, 16)}, current ${outputHash.slice(0, 16)}`);
    changedDependencies.push("output");
  }
  if (manifest.creationStatus !== "complete") {
    reasons.push(`creationStatus is ${manifest.creationStatus}, expected complete`);
    changedDependencies.push("creationStatus");
  }
  if (manifest.schemaVersions.runtimeContract !== RUNTIME_SCHEMA_CONTRACT_VERSION) {
    reasons.push(`runtime schema contract changed: manifest ${manifest.schemaVersions.runtimeContract}, current ${RUNTIME_SCHEMA_CONTRACT_VERSION}`);
    changedDependencies.push("runtime-schema-contract-version");
  }
  if (manifest.schemaVersions.configContract !== CONFIG_SCHEMA_CONTRACT_VERSION) {
    reasons.push(`config schema contract changed: manifest ${manifest.schemaVersions.configContract}, current ${CONFIG_SCHEMA_CONTRACT_VERSION}`);
    changedDependencies.push("config-schema-contract-version");
  }
  if (manifest.generator.name !== options.generatorName) {
    reasons.push(`generator changed: manifest ${manifest.generator.name}, current ${options.generatorName}`);
    changedDependencies.push("generator");
  }
  const codeVersion = options.codeVersion ?? STAGE_CACHE_CODE_VERSION;
  if (manifest.generator.codeVersion !== codeVersion) {
    reasons.push(`generator-code-version changed: manifest ${manifest.generator.codeVersion}, current ${codeVersion}`);
    changedDependencies.push("generator-code-version");
  }
  if (manifest.provider.tier !== options.provider.tier) {
    reasons.push(`provider tier changed: manifest ${manifest.provider.tier}, current ${options.provider.tier}`);
    changedDependencies.push("provider-tier");
  }
  if (manifest.provider.provider !== options.provider.provider) {
    reasons.push(`provider changed: manifest ${manifest.provider.provider}, current ${options.provider.provider}`);
    changedDependencies.push("provider");
  }
  if (manifest.provider.model !== options.provider.model) {
    reasons.push(`model changed: manifest ${manifest.provider.model}, current ${options.provider.model}`);
    changedDependencies.push("model");
  }

  const expectedInputs = normalizeDependencies(options.inputs);
  const manifestById = new Map(manifest.inputs.map((dep) => [dep.id, dep]));
  const expectedById = new Map(expectedInputs.map((dep) => [dep.id, dep]));

  for (const expected of expectedInputs) {
    const prior = manifestById.get(expected.id);
    if (!prior) {
      reasons.push(`dependency ${expected.id} missing from cache manifest`);
      changedDependencies.push(expected.id);
      continue;
    }
    if (prior.status !== expected.status) {
      reasons.push(`dependency ${expected.id} changed: manifest ${prior.status}, current ${expected.status}`);
      changedDependencies.push(expected.id);
      continue;
    }
    if (prior.hash !== expected.hash) {
      reasons.push(`dependency ${expected.id} changed: manifest ${prior.hash.slice(0, 16)}, current ${expected.hash.slice(0, 16)}`);
      changedDependencies.push(expected.id);
    }
  }
  for (const prior of manifest.inputs) {
    if (!expectedById.has(prior.id)) {
      reasons.push(`dependency ${prior.id} is declared by cache but not by current code`);
      changedDependencies.push(prior.id);
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons, changedDependencies: unique(changedDependencies), manifest, outputHash };
  }
  return { ok: true, manifest, outputHash };
}

export async function loadOrBuildCachedJson<T>(options: StageCacheWriteOptions & {
  force?: boolean;
  allowGenerate: boolean;
  label: string;
  log: (message: string) => void;
  generator: () => Promise<T>;
  validateValue?: (value: T) => string[];
}): Promise<T> {
  const manifestOptions: StageCacheValidateOptions = {
    artifactPath: options.artifactPath,
    artifactType: options.artifactType,
    artifactId: options.artifactId,
    inputs: options.inputs,
    generatorName: options.generatorName,
    provider: options.provider,
    codeVersion: options.codeVersion,
  };

  if (existsSync(options.artifactPath) && !options.force) {
    const validation = validateStageCache(manifestOptions);
    if (validation.ok) {
      try {
        const cached = JSON.parse(readFileSync(options.artifactPath, "utf8")) as T;
        const valueProblems = options.validateValue?.(cached) ?? [];
        if (valueProblems.length === 0) {
          options.log(`${options.label}: reusing cached`);
          return cached;
        }
        const reasons = valueProblems.map((problem) => `runtime schema failed: ${problem}`);
        if (!options.allowGenerate) throw new StaleCacheError(options.artifactId, reasons, ["runtime-schema"]);
        quarantineInvalidArtifact(options.artifactPath, reasons);
        options.log(`${options.label}: cache invalid (${reasons.join("; ")}) — regenerating`);
      } catch (err) {
        if (err instanceof StaleCacheError) throw err;
        const reasons = [`cached JSON unreadable: ${(err as Error).message}`];
        if (!options.allowGenerate) throw new StaleCacheError(options.artifactId, reasons, ["output"]);
        quarantineInvalidArtifact(options.artifactPath, reasons);
        options.log(`${options.label}: cached file unreadable — regenerating`);
      }
    } else {
      if (!options.allowGenerate) {
        throw new StaleCacheError(options.artifactId, validation.reasons, validation.changedDependencies);
      }
      quarantineInvalidArtifact(options.artifactPath, validation.reasons);
      options.log(`${options.label}: cache invalid (${validation.changedDependencies.join(", ")}) — regenerating`);
    }
  } else if (existsSync(options.artifactPath) && options.force) {
    if (!options.allowGenerate) {
      throw new StaleCacheError(options.artifactId, ["--force bypasses cache reuse but model generation is disabled"], ["force"]);
    }
    quarantineInvalidArtifact(options.artifactPath, ["--force bypassed cache reuse"]);
    options.log(`${options.label}: --force bypassed cache reuse — regenerating`);
  }

  if (!options.allowGenerate) {
    throw new StaleCacheError(options.artifactId, [`no reusable cache at ${options.artifactPath}`], ["output"]);
  }

  options.log(`${options.label}: generating...`);
  const value = await options.generator();
  const valueProblems = options.validateValue?.(value) ?? [];
  if (valueProblems.length > 0) {
    throw new Error(`${options.label}: generated artifact failed runtime schema: ${valueProblems.join("; ")}`);
  }
  writeFileAtomic(options.artifactPath, JSON.stringify(value, null, 2));
  writeStageCacheManifest(options);
  return value;
}

export function quarantineInvalidArtifact(artifactPath: string, reasons: string[]): string | null {
  if (!existsSync(artifactPath)) return null;
  const hash = hashFile(artifactPath)?.slice(0, 16) ?? "unknown";
  const stamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
  const dir = resolve(dirname(artifactPath), "_stale-cache");
  const dest = resolve(dir, `${basename(artifactPath)}.stale.${stamp}.${hash}`);
  writeFileAtomic(
    `${dest}.reason.json`,
    JSON.stringify({ artifactPath, preservedAt: new Date().toISOString(), reasons }, null, 2),
  );
  copyFileSync(artifactPath, dest);
  const manifestPath = manifestPathFor(artifactPath);
  if (existsSync(manifestPath)) {
    copyFileSync(manifestPath, `${dest}.cache-manifest.json`);
  }
  return dest;
}

function parseStageCacheManifest(raw: unknown): { ok: true; manifest: StageCacheManifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["cache manifest must be an object"] };
  const m = raw as Partial<StageCacheManifest>;
  if (m.schemaVersion !== STAGE_CACHE_SCHEMA_VERSION) errors.push(`schemaVersion changed: manifest ${String(m.schemaVersion)}, current ${STAGE_CACHE_SCHEMA_VERSION}`);
  if (!m.schemaVersions || typeof m.schemaVersions !== "object") {
    errors.push("schemaVersions must be an object");
  } else {
    if (m.schemaVersions.stageCache !== STAGE_CACHE_SCHEMA_VERSION) errors.push(`schemaVersions.stageCache changed: manifest ${String(m.schemaVersions.stageCache)}, current ${STAGE_CACHE_SCHEMA_VERSION}`);
    if (m.schemaVersions.runtimeContract !== RUNTIME_SCHEMA_CONTRACT_VERSION) errors.push(`schemaVersions.runtimeContract changed: manifest ${String(m.schemaVersions.runtimeContract)}, current ${RUNTIME_SCHEMA_CONTRACT_VERSION}`);
    if (m.schemaVersions.configContract !== CONFIG_SCHEMA_CONTRACT_VERSION) errors.push(`schemaVersions.configContract changed: manifest ${String(m.schemaVersions.configContract)}, current ${CONFIG_SCHEMA_CONTRACT_VERSION}`);
  }
  if (!isArtifactType(m.artifactType)) errors.push(`artifactType is invalid: ${String(m.artifactType)}`);
  if (typeof m.artifactId !== "string" || !m.artifactId) errors.push("artifactId must be a non-empty string");
  if (typeof m.outputPath !== "string" || !m.outputPath) errors.push("outputPath must be a non-empty string");
  if (typeof m.outputHash !== "string" || !m.outputHash) errors.push("outputHash must be a non-empty string");
  if (!Array.isArray(m.inputs)) errors.push("inputs must be an array");
  if (!m.generator || typeof m.generator !== "object") errors.push("generator must be an object");
  if (!m.provider || typeof m.provider !== "object") errors.push("provider must be an object");
  if (m.creationStatus !== "complete" && m.creationStatus !== "blocked" && m.creationStatus !== "partial") {
    errors.push(`creationStatus is invalid: ${String(m.creationStatus)}`);
  }
  if (typeof m.createdAt !== "string" || !m.createdAt) errors.push("createdAt must be a non-empty string");

  const deps = Array.isArray(m.inputs) ? m.inputs : [];
  deps.forEach((dep, i) => {
    if (!dep || typeof dep !== "object") {
      errors.push(`inputs[${i}] must be an object`);
      return;
    }
    const d = dep as Partial<CacheDependency>;
    if (typeof d.id !== "string" || !d.id) errors.push(`inputs[${i}].id must be a non-empty string`);
    if (typeof d.hash !== "string" || !d.hash) errors.push(`inputs[${i}].hash must be a non-empty string`);
    if (d.status !== "present" && d.status !== "missing") errors.push(`inputs[${i}].status must be present or missing`);
    if (d.path !== undefined && typeof d.path !== "string") errors.push(`inputs[${i}].path must be a string when present`);
  });

  if (m.generator && typeof m.generator === "object") {
    if (typeof m.generator.name !== "string" || !m.generator.name) errors.push("generator.name must be a non-empty string");
    if (typeof m.generator.codeVersion !== "string" || !m.generator.codeVersion) errors.push("generator.codeVersion must be a non-empty string");
  }
  if (m.provider && typeof m.provider === "object") {
    if (m.provider.tier !== "writer" && m.provider.tier !== "researcher" && m.provider.tier !== "critic") errors.push("provider.tier is invalid");
    if (!isProviderName(m.provider.provider)) errors.push("provider.provider is invalid");
    if (typeof m.provider.model !== "string" || !m.provider.model) errors.push("provider.model must be a non-empty string");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: m as StageCacheManifest };
}

function normalizeDependencies(inputs: CacheDependency[]): CacheDependency[] {
  return [...inputs].sort((a, b) => a.id.localeCompare(b.id));
}

function firstPresentHash(inputs: CacheDependency[], prefix: string): string | null {
  return inputs.find((dep) => dep.id.startsWith(prefix) && dep.status === "present")?.hash ?? null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function allConfigFiles(): string[] {
  try {
    return readdirSync(CONFIG_DIR).filter((file) => file.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

function currentProviderName(): ProviderName {
  const raw = process.env.CHAPTERFLOW_PROVIDER;
  if (!raw) return "anthropic-cli";
  if (isProviderName(raw)) return raw;
  return "anthropic-cli";
}

function defaultModel(provider: ProviderName, tier: AgentTier): string {
  const defaults: Record<ProviderName, Record<AgentTier, string>> = {
    "anthropic-cli": {
      writer: "claude-opus-4-7",
      researcher: "claude-sonnet-4-6",
      critic: "claude-haiku-4-5-20251001",
    },
    "anthropic-api": {
      writer: process.env.CHAPTERFLOW_ANTHROPIC_WRITER ?? "claude-opus-4-7",
      researcher: process.env.CHAPTERFLOW_ANTHROPIC_RESEARCHER ?? "claude-sonnet-4-6",
      critic: process.env.CHAPTERFLOW_ANTHROPIC_CRITIC ?? "claude-haiku-4-5-20251001",
    },
    "openai-api": {
      writer: process.env.CHAPTERFLOW_OPENAI_WRITER ?? "gpt-4o",
      researcher: process.env.CHAPTERFLOW_OPENAI_RESEARCHER ?? "gpt-4o-mini",
      critic: process.env.CHAPTERFLOW_OPENAI_CRITIC ?? "gpt-4o-mini",
    },
  };
  return defaults[provider][tier];
}

function isProviderName(value: unknown): value is ProviderName {
  return value === "anthropic-cli" || value === "anthropic-api" || value === "openai-api";
}

function isArtifactType(value: unknown): value is StageArtifactType {
  return (
    value === "book-brief" ||
    value === "chapter-plan" ||
    value === "chapter" ||
    value === "hook" ||
    value === "breakdown" ||
    value === "example" ||
    value === "quiz" ||
    value === "cards" ||
    value === "implementation-plan" ||
    value === "support"
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
