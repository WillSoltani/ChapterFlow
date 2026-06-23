import { createHash, randomBytes, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import { hostname } from "os";
import { dirname, resolve } from "path";

import { writeFileAtomic } from "./atomicWrite.js";
import { normSlug } from "./chapterPaths.js";

export const RESEARCH_RUN_SCHEMA_VERSION = "chapterflow.researchRunManifest.v1" as const;
export const RESEARCH_RUN_MANIFEST_FILE = "research-run.manifest.json" as const;
export const RESEARCH_RUN_CODE_VERSION = "researcher-durable-resume-2026-06-23.1" as const;
export const DEFAULT_RESEARCH_LEASE_TTL_MS = 30 * 60 * 1000;

export type ResearchRunOverallStatus = "running" | "failed" | "coherence_failed" | "complete";
export type ResearchChapterStatus = "pending" | "in_progress" | "succeeded" | "failed";
export type ResearchCoherenceStatus = "pending" | "passed" | "failed";

export type ResearchExpectedChapter = {
  number: number;
  title: string;
};

export type ResearchCompatibility = {
  codeVersion: string;
  promptHash: string;
  configHash: string;
  provider: string;
  model: string;
};

export type ResearchInputIdentity = {
  title: string;
  author: string;
  bookIdHint: string | null;
  hash: string;
};

export type ResearchLease = {
  ownerId: string;
  pid: number;
  host: string;
  claimedAt: string;
  expiresAt: string;
};

export type ResearchChapterError = {
  at: string;
  attempt: number;
  message: string;
};

export type ResearchChapterManifestEntry = {
  chapterNumber: number;
  chapterTitle: string;
  status: ResearchChapterStatus;
  attempts: number;
  errors: ResearchChapterError[];
  lease?: ResearchLease;
  outputJsonHash?: string;
  outputTextHash?: string;
  completedAt?: string;
  updatedAt: string;
};

export type ResearchRunEvent = {
  at: string;
  type: string;
  message: string;
  chapterNumber?: number;
  data?: Record<string, unknown>;
};

export type ResearchRunManifest = {
  schemaVersion: typeof RESEARCH_RUN_SCHEMA_VERSION;
  runId: string;
  bookId: string;
  createdAt: string;
  updatedAt: string;
  overallStatus: ResearchRunOverallStatus;
  input: ResearchInputIdentity;
  bibliography: {
    hash: string;
    path: string;
  };
  expectedChapters: ResearchExpectedChapter[];
  expectedChaptersHash: string;
  compatibility: ResearchCompatibility;
  chapters: Record<string, ResearchChapterManifestEntry>;
  coherence: {
    status: ResearchCoherenceStatus;
    checkedAt?: string;
    reportHash?: string;
    blockerCount?: number;
  };
  events: ResearchRunEvent[];
};

export type ManifestParseResult =
  | { ok: true; manifest: ResearchRunManifest }
  | { ok: false; errors: string[] };

export type CompatibleRunResult =
  | {
      ok: true;
      runDir: string;
      manifest: ResearchRunManifest;
      rejected: ResearchRunRejection[];
    }
  | {
      ok: false;
      rejected: ResearchRunRejection[];
    };

export type ResearchRunRejection = {
  runDir: string;
  reason: string;
};

export type ChapterClaimResult =
  | { ok: true; lease: ResearchLease; release: () => void }
  | { ok: false; reason: string };

type LockRecord = ResearchLease & {
  schemaVersion: typeof RESEARCH_RUN_SCHEMA_VERSION;
  kind: "chapter" | "manifest";
  runId: string;
  chapterNumber?: number;
};

export function researchRunManifestPath(runDir: string): string {
  return resolve(runDir, RESEARCH_RUN_MANIFEST_FILE);
}

export function chapterKey(chapterNumber: number): string {
  return String(chapterNumber).padStart(2, "0");
}

export function sourceJsonRelPath(chapterNumber: number): string {
  return `sidecars/source/ch${chapterKey(chapterNumber)}.source.json`;
}

export function sourceTextRelPath(chapterNumber: number): string {
  return `sidecars/source/ch${chapterKey(chapterNumber)}.source.txt`;
}

export function sourceJsonPath(runDir: string, chapterNumber: number): string {
  return resolve(runDir, sourceJsonRelPath(chapterNumber));
}

export function sourceTextPath(runDir: string, chapterNumber: number): string {
  return resolve(runDir, sourceTextRelPath(chapterNumber));
}

export function createResearchRunId(now: Date = new Date(), entropy: () => string = randomUUID): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "T",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
    pad(now.getUTCMilliseconds(), 3),
    "Z-",
    entropy(),
  ].join("");
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown): string {
  return hashString(stableJson(value));
}

export function researchInputHash(input: { title: string; author: string; bookIdHint?: string }): string {
  return hashJson({
    title: input.title,
    author: input.author,
    bookIdHint: input.bookIdHint ?? null,
  });
}

export function expectedChaptersHash(chapters: ResearchExpectedChapter[]): string {
  return hashJson(chapters.map((ch) => ({ number: ch.number, title: ch.title })));
}

export function readResearchRunManifest(runDir: string): ManifestParseResult {
  try {
    return parseResearchRunManifest(JSON.parse(readFileSync(researchRunManifestPath(runDir), "utf8")));
  } catch (err) {
    return { ok: false, errors: [`manifest unreadable: ${(err as Error).message}`] };
  }
}

export function parseResearchRunManifest(raw: unknown): ManifestParseResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["manifest must be an object"] };

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== RESEARCH_RUN_SCHEMA_VERSION) errors.push("schemaVersion mismatch or missing");

  const runId = stringField(raw, "runId", errors);
  const bookId = stringField(raw, "bookId", errors);
  const createdAt = isoField(raw, "createdAt", errors);
  const updatedAt = isoField(raw, "updatedAt", errors);
  const overallStatus = enumField<ResearchRunOverallStatus>(raw, "overallStatus", ["running", "failed", "coherence_failed", "complete"], errors);

  const inputRaw = recordField(raw, "input", errors);
  const input = inputRaw
    ? {
        title: stringField(inputRaw, "title", errors),
        author: stringField(inputRaw, "author", errors),
        bookIdHint: nullableStringField(inputRaw, "bookIdHint", errors),
        hash: stringField(inputRaw, "hash", errors),
      }
    : { title: "", author: "", bookIdHint: null, hash: "" };

  const bibliographyRaw = recordField(raw, "bibliography", errors);
  const bibliography = bibliographyRaw
    ? {
        hash: stringField(bibliographyRaw, "hash", errors),
        path: stringField(bibliographyRaw, "path", errors),
      }
    : { hash: "", path: "" };

  const expectedChaptersRaw = arrayField(raw, "expectedChapters", errors);
  const expectedChapters: ResearchExpectedChapter[] = [];
  if (expectedChaptersRaw) {
    expectedChaptersRaw.forEach((item, i) => {
      if (!isRecord(item)) {
        errors.push(`expectedChapters[${i}] must be an object`);
        return;
      }
      expectedChapters.push({
        number: intField(item, "number", errors),
        title: stringField(item, "title", errors),
      });
    });
  }
  if (expectedChapters.length === 0) errors.push("expectedChapters must not be empty");

  const manifestExpectedHash = stringField(raw, "expectedChaptersHash", errors);
  if (expectedChapters.length > 0 && manifestExpectedHash && manifestExpectedHash !== expectedChaptersHash(expectedChapters)) {
    errors.push("expectedChaptersHash does not match expectedChapters");
  }

  const compatibilityRaw = recordField(raw, "compatibility", errors);
  const compatibility = compatibilityRaw
    ? {
        codeVersion: stringField(compatibilityRaw, "codeVersion", errors),
        promptHash: stringField(compatibilityRaw, "promptHash", errors),
        configHash: stringField(compatibilityRaw, "configHash", errors),
        provider: stringField(compatibilityRaw, "provider", errors),
        model: stringField(compatibilityRaw, "model", errors),
      }
    : { codeVersion: "", promptHash: "", configHash: "", provider: "", model: "" };

  const chaptersRaw = recordField(raw, "chapters", errors);
  const chapters: Record<string, ResearchChapterManifestEntry> = {};
  if (chaptersRaw) {
    for (const [key, value] of Object.entries(chaptersRaw)) {
      if (!isRecord(value)) {
        errors.push(`chapters.${key} must be an object`);
        continue;
      }
      const status = enumField<ResearchChapterStatus>(value, "status", ["pending", "in_progress", "succeeded", "failed"], errors);
      const entry: ResearchChapterManifestEntry = {
        chapterNumber: intField(value, "chapterNumber", errors),
        chapterTitle: stringField(value, "chapterTitle", errors),
        status,
        attempts: nonnegativeIntField(value, "attempts", errors),
        errors: parseErrorsArray(value.errors, `chapters.${key}.errors`, errors),
        updatedAt: isoField(value, "updatedAt", errors),
      };
      if (isRecord(value.lease)) entry.lease = parseLease(value.lease, `chapters.${key}.lease`, errors);
      if (typeof value.outputJsonHash === "string") entry.outputJsonHash = value.outputJsonHash;
      if (typeof value.outputTextHash === "string") entry.outputTextHash = value.outputTextHash;
      if (typeof value.completedAt === "string") entry.completedAt = value.completedAt;
      if (status === "succeeded" && (!entry.outputJsonHash || !entry.outputTextHash || !entry.completedAt)) {
        errors.push(`chapters.${key} succeeded entry is missing output hashes or completedAt`);
      }
      chapters[key] = entry;
    }
  }
  for (const ch of expectedChapters) {
    const key = chapterKey(ch.number);
    if (!chapters[key]) errors.push(`chapters.${key} missing from manifest`);
    if (chapters[key] && chapters[key].chapterTitle !== ch.title) errors.push(`chapters.${key} title does not match expectedChapters`);
  }

  const coherenceRaw = recordField(raw, "coherence", errors);
  const coherence = coherenceRaw
    ? {
        status: enumField<ResearchCoherenceStatus>(coherenceRaw, "status", ["pending", "passed", "failed"], errors),
        checkedAt: typeof coherenceRaw.checkedAt === "string" ? coherenceRaw.checkedAt : undefined,
        reportHash: typeof coherenceRaw.reportHash === "string" ? coherenceRaw.reportHash : undefined,
        blockerCount: typeof coherenceRaw.blockerCount === "number" ? coherenceRaw.blockerCount : undefined,
      }
    : { status: "pending" as ResearchCoherenceStatus };

  const eventsRaw = arrayField(raw, "events", errors) ?? [];
  const events: ResearchRunEvent[] = [];
  eventsRaw.forEach((item, i) => {
    if (!isRecord(item)) {
      errors.push(`events[${i}] must be an object`);
      return;
    }
    events.push({
      at: isoField(item, "at", errors),
      type: stringField(item, "type", errors),
      message: stringField(item, "message", errors),
      chapterNumber: typeof item.chapterNumber === "number" ? item.chapterNumber : undefined,
      data: isRecord(item.data) ? item.data : undefined,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      schemaVersion: RESEARCH_RUN_SCHEMA_VERSION,
      runId,
      bookId,
      createdAt,
      updatedAt,
      overallStatus,
      input,
      bibliography,
      expectedChapters,
      expectedChaptersHash: manifestExpectedHash,
      compatibility,
      chapters,
      coherence,
      events,
    },
  };
}

export function buildInitialResearchRunManifest(args: {
  runId: string;
  bookId: string;
  createdAt: string;
  input: ResearchInputIdentity;
  bibliographyHash: string;
  bibliographyPath: string;
  expectedChapters: ResearchExpectedChapter[];
  compatibility: ResearchCompatibility;
}): ResearchRunManifest {
  const chapters: Record<string, ResearchChapterManifestEntry> = {};
  for (const ch of args.expectedChapters) {
    chapters[chapterKey(ch.number)] = {
      chapterNumber: ch.number,
      chapterTitle: ch.title,
      status: "pending",
      attempts: 0,
      errors: [],
      updatedAt: args.createdAt,
    };
  }
  return {
    schemaVersion: RESEARCH_RUN_SCHEMA_VERSION,
    runId: args.runId,
    bookId: args.bookId,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
    overallStatus: "running",
    input: args.input,
    bibliography: {
      hash: args.bibliographyHash,
      path: args.bibliographyPath,
    },
    expectedChapters: args.expectedChapters,
    expectedChaptersHash: expectedChaptersHash(args.expectedChapters),
    compatibility: args.compatibility,
    chapters,
    coherence: { status: "pending" },
    events: [{
      at: args.createdAt,
      type: "run.created",
      message: "Created research run manifest.",
    }],
  };
}

export function writeResearchRunManifest(runDir: string, manifest: ResearchRunManifest): void {
  writeFileAtomic(researchRunManifestPath(runDir), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function appendResearchEvent(manifest: ResearchRunManifest, event: Omit<ResearchRunEvent, "at"> & { at?: string }, nowIso: string): void {
  manifest.events.push({ at: event.at ?? nowIso, type: event.type, message: event.message, chapterNumber: event.chapterNumber, data: event.data });
}

export function findCompatibleResearchRun(args: {
  runsRoot: string;
  bookIdHint?: string;
  inputHash: string;
  compatibility: ResearchCompatibility;
  expectedChaptersHash?: string;
}): CompatibleRunResult {
  const rejected: ResearchRunRejection[] = [];
  const candidates = listManifestRunDirs(args.runsRoot, args.bookIdHint).sort((a, b) => {
    const at = a.createdAtMs ?? -1;
    const bt = b.createdAtMs ?? -1;
    if (at !== bt) return bt - at;
    return a.runDir < b.runDir ? 1 : a.runDir > b.runDir ? -1 : 0;
  });

  for (const candidate of candidates) {
    if (!candidate.parsed.ok) {
      rejected.push({ runDir: candidate.runDir, reason: candidate.parsed.errors.join("; ") });
      continue;
    }
    const manifest = candidate.parsed.manifest;
    const reasons = compatibilityRejectionReasons(manifest, args);
    if (reasons.length === 0) return { ok: true, runDir: candidate.runDir, manifest, rejected };
    rejected.push({ runDir: candidate.runDir, reason: reasons.join("; ") });
  }
  return { ok: false, rejected };
}

export function compatibilityRejectionReasons(
  manifest: ResearchRunManifest,
  args: { inputHash: string; compatibility: ResearchCompatibility; expectedChaptersHash?: string },
): string[] {
  const reasons: string[] = [];
  if (manifest.input.hash !== args.inputHash) reasons.push("input hash changed");
  if (args.expectedChaptersHash && manifest.expectedChaptersHash !== args.expectedChaptersHash) reasons.push("expected chapter set changed");
  for (const key of ["codeVersion", "promptHash", "configHash", "provider", "model"] as const) {
    if (manifest.compatibility[key] !== args.compatibility[key]) reasons.push(`${key} changed`);
  }
  return reasons;
}

export function acquireChapterClaim(args: {
  runDir: string;
  runId: string;
  chapterNumber: number;
  ownerId: string;
  now: Date;
  ttlMs: number;
}): ChapterClaimResult {
  return acquireLockFile({
    path: chapterClaimPath(args.runDir, args.chapterNumber),
    kind: "chapter",
    runId: args.runId,
    chapterNumber: args.chapterNumber,
    ownerId: args.ownerId,
    now: args.now,
    ttlMs: args.ttlMs,
  });
}

export function withManifestUpdateLock<T>(args: {
  runDir: string;
  runId: string;
  ownerId: string;
  now: Date;
  ttlMs: number;
  update: (manifest: ResearchRunManifest) => T;
}): T {
  const lock = acquireLockFile({
    path: resolve(args.runDir, "manifest.lock"),
    kind: "manifest",
    runId: args.runId,
    ownerId: args.ownerId,
    now: args.now,
    ttlMs: args.ttlMs,
  });
  if (!lock.ok) throw new Error(`could not acquire manifest update lock: ${lock.reason}`);
  try {
    const parsed = readResearchRunManifest(args.runDir);
    if (!parsed.ok) throw new Error(`manifest invalid during update: ${parsed.errors.join("; ")}`);
    const result = args.update(parsed.manifest);
    writeResearchRunManifest(args.runDir, parsed.manifest);
    return result;
  } finally {
    lock.release();
  }
}

export function chapterClaimPath(runDir: string, chapterNumber: number): string {
  return resolve(runDir, "claims", `ch${chapterKey(chapterNumber)}.claim.json`);
}

export function fileHash(path: string): string {
  return hashString(readFileSync(path, "utf8"));
}

function listManifestRunDirs(runsRoot: string, bookIdHint?: string): Array<{ runDir: string; parsed: ManifestParseResult; createdAtMs: number | null }> {
  const out: Array<{ runDir: string; parsed: ManifestParseResult; createdAtMs: number | null }> = [];
  let bookDirs: string[] = [];
  try {
    bookDirs = readdirSync(runsRoot)
      .map((name) => resolve(runsRoot, name))
      .filter((path) => safeIsDir(path));
  } catch {
    return out;
  }

  const wanted = bookIdHint ? normSlug(bookIdHint) : null;
  for (const bookDir of bookDirs) {
    const bookName = bookDir.split("/").pop() ?? "";
    if (wanted && normSlug(bookName) !== wanted) continue;
    let runNames: string[] = [];
    try {
      runNames = readdirSync(bookDir);
    } catch {
      continue;
    }
    for (const runName of runNames) {
      const runDir = resolve(bookDir, runName);
      if (!safeIsDir(runDir)) continue;
      const manifestPath = researchRunManifestPath(runDir);
      if (!existsSync(manifestPath)) {
        out.push({ runDir, parsed: { ok: false, errors: ["manifest missing"] }, createdAtMs: null });
        continue;
      }
      const parsed = readResearchRunManifest(runDir);
      const createdAtMs = parsed.ok ? Date.parse(parsed.manifest.createdAt) : null;
      out.push({ runDir, parsed, createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null });
    }
  }
  return out;
}

function acquireLockFile(args: {
  path: string;
  kind: "chapter" | "manifest";
  runId: string;
  chapterNumber?: number;
  ownerId: string;
  now: Date;
  ttlMs: number;
}): ChapterClaimResult {
  const lease: ResearchLease = {
    ownerId: args.ownerId,
    pid: process.pid,
    host: hostname(),
    claimedAt: args.now.toISOString(),
    expiresAt: new Date(args.now.getTime() + args.ttlMs).toISOString(),
  };
  const record: LockRecord = {
    schemaVersion: RESEARCH_RUN_SCHEMA_VERSION,
    kind: args.kind,
    runId: args.runId,
    chapterNumber: args.chapterNumber,
    ...lease,
  };
  mkdirSync(dirname(args.path), { recursive: true });

  while (true) {
    try {
      writeFileSync(args.path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return {
        ok: true,
        lease,
        release: () => releaseLockFile(args.path, args.ownerId),
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") return { ok: false, reason: `claim write failed (${(err as Error).message})` };
      const existing = readLockRecord(args.path);
      if (existing.ok && !leaseIsExpired(existing.record, args.now)) {
        return { ok: false, reason: `held by ${existing.record.ownerId} until ${existing.record.expiresAt}` };
      }
      const suffix = randomBytes(4).toString("hex");
      const aside = `${args.path}.stale-${args.ownerId}-${suffix}`;
      try {
        renameSync(args.path, aside);
      } catch (renameErr) {
        return { ok: false, reason: `lost stale-claim recovery race (${(renameErr as NodeJS.ErrnoException).code ?? "unknown"})` };
      }
    }
  }
}

function releaseLockFile(path: string, ownerId: string): void {
  const existing = readLockRecord(path);
  if (!existing.ok || existing.record.ownerId !== ownerId) return;
  try {
    unlinkSync(path);
  } catch {
    // Best-effort: a stale owned lock is recoverable by TTL.
  }
}

function readLockRecord(path: string): { ok: true; record: LockRecord } | { ok: false } {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(raw)) return { ok: false };
    const expiresAt = typeof raw.expiresAt === "string" ? raw.expiresAt : "";
    const ownerId = typeof raw.ownerId === "string" ? raw.ownerId : "";
    const claimedAt = typeof raw.claimedAt === "string" ? raw.claimedAt : "";
    if (!expiresAt || !ownerId || !claimedAt) return { ok: false };
    return { ok: true, record: raw as LockRecord };
  } catch {
    return { ok: false };
  }
}

function leaseIsExpired(lease: { expiresAt?: string }, now: Date): boolean {
  const expiresAtMs = Date.parse(lease.expiresAt ?? "");
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime();
}

function parseLease(raw: Record<string, unknown>, label: string, errors: string[]): ResearchLease {
  return {
    ownerId: stringField(raw, "ownerId", errors, label),
    pid: intField(raw, "pid", errors, label),
    host: stringField(raw, "host", errors, label),
    claimedAt: isoField(raw, "claimedAt", errors, label),
    expiresAt: isoField(raw, "expiresAt", errors, label),
  };
}

function parseErrorsArray(raw: unknown, label: string, errors: string[]): ResearchChapterError[] {
  if (!Array.isArray(raw)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  return raw.map((item, i) => {
    if (!isRecord(item)) {
      errors.push(`${label}[${i}] must be an object`);
      return { at: "", attempt: 0, message: "" };
    }
    return {
      at: isoField(item, "at", errors, `${label}[${i}]`),
      attempt: intField(item, "attempt", errors, `${label}[${i}]`),
      message: stringField(item, "message", errors, `${label}[${i}]`),
    };
  });
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = sortJson(value[key]);
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringField(raw: Record<string, unknown>, field: string, errors: string[], prefix?: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${prefix ? `${prefix}.` : ""}${field} must be a non-empty string`);
    return "";
  }
  return value;
}

function nullableStringField(raw: Record<string, unknown>, field: string, errors: string[]): string | null {
  const value = raw[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    errors.push(`${field} must be a string or null`);
    return null;
  }
  return value;
}

function isoField(raw: Record<string, unknown>, field: string, errors: string[], prefix?: string): string {
  const value = stringField(raw, field, errors, prefix);
  if (value && !Number.isFinite(Date.parse(value))) errors.push(`${prefix ? `${prefix}.` : ""}${field} must be an ISO timestamp`);
  return value;
}

function intField(raw: Record<string, unknown>, field: string, errors: string[], prefix?: string): number {
  const value = raw[field];
  if (!Number.isInteger(value)) {
    errors.push(`${prefix ? `${prefix}.` : ""}${field} must be an integer`);
    return 0;
  }
  return value as number;
}

function nonnegativeIntField(raw: Record<string, unknown>, field: string, errors: string[]): number {
  const value = intField(raw, field, errors);
  if (value < 0) errors.push(`${field} must be non-negative`);
  return value;
}

function enumField<T extends string>(raw: Record<string, unknown>, field: string, values: readonly T[], errors: string[]): T {
  const value = raw[field];
  if (typeof value !== "string" || !values.includes(value as T)) {
    errors.push(`${field} must be one of ${values.join(", ")}`);
    return values[0];
  }
  return value as T;
}

function recordField(raw: Record<string, unknown>, field: string, errors: string[]): Record<string, unknown> | null {
  const value = raw[field];
  if (!isRecord(value)) {
    errors.push(`${field} must be an object`);
    return null;
  }
  return value;
}

function arrayField(raw: Record<string, unknown>, field: string, errors: string[]): unknown[] | null {
  const value = raw[field];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return null;
  }
  return value;
}

function safeIsDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function removePath(path: string): void {
  rmSync(path, { force: true });
}
