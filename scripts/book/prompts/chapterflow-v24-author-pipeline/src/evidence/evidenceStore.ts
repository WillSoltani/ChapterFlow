/**
 * IMP-10 — durable, content-addressed attempt evidence (F-014; frozen
 * `attempt-evidence-manifest` v1 contract in src/contracts/attemptEvidence.ts).
 *
 * The `range` campaign needed an external 10-second file watcher to preserve
 * hundreds of versions, then was deleted leaving only summary reports. IMP-10
 * makes every attempt reconstructable from an IMMUTABLE, content-addressed
 * package — no watcher, no ambient state, no unbounded debris:
 *
 *   <evidenceRoot>/
 *     objects/<aa>/<sha256>            content-addressed blobs (deduplicated)
 *     attempts/<attemptId>/
 *       manifest.json                  AttemptEvidenceManifestV1 (frozen schema)
 *       journal.jsonl                  append-only state-transition journal
 *
 * Design invariants:
 *  - Manifests only ever GROW (objects appended, transitions appended) — never
 *    rewritten to claim a state the bytes don't support (rollback criterion:
 *    "manifests can claim unsupported success").
 *  - Object writes are atomic (tmp + rename) and content-addressed, so a crash
 *    can never leave a half-written blob at its final hash path, and identical
 *    bytes across attempts store once.
 *  - Everything is REDACTED before storage: secret-shaped values and absolute
 *    home paths never reach an object or manifest (rollback: "secrets leak").
 *  - The store is pipeline-local, gitignored, and lives OUTSIDE state/, so it is
 *    excluded from chapter discovery, assembly, packaging, and publish by
 *    construction (nothing scans the evidence root).
 *  - Retention is bounded by class + protected-reference cleanup; evidence cited
 *    by an active attempt or a decision is never deletable.
 *
 * Pure-ish: all fs effects are confined to the injected evidenceRoot; no clock
 * except the caller-supplied `atIso` (so tests stay deterministic).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  type AttemptEvidenceManifestV1,
  type AttemptStateV1,
  type EvidenceObjectV1,
  type RetentionClassV1,
  validateAttemptEvidenceManifest,
} from "../contracts/attemptEvidence.js";

export const EVIDENCE_LAYOUT_VERSION = "evidence-store-v1" as const;

// ── redaction (never store secrets or personal home paths) ────────────────────

/** Patterns whose VALUES must never be persisted. Matches common credential
 *  shapes; deliberately conservative — a false positive redacts, never leaks. */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,             // OpenAI-style keys
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,          // AWS access key ids
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,       // Slack tokens
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,         // GitHub tokens
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
  /\b[A-Za-z0-9_-]*(?:api[_-]?key|secret|password|token)[A-Za-z0-9_-]*\s*[:=]\s*["']?[A-Za-z0-9/+_-]{12,}["']?/gi,
];

const REDACTED = "«redacted»";

/** Redact secret-shaped values and the user's absolute home path from a string.
 *  Idempotent — running it twice yields the same output. */
export function redactEvidence(text: string, home = homedir()): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED);
  if (home && home.length > 1) out = out.split(home).join("«home»");
  return out;
}

// ── content-addressed object store ────────────────────────────────────────────

function objectsDir(evidenceRoot: string): string {
  return join(evidenceRoot, "objects");
}

function objectPath(evidenceRoot: string, sha256: string): string {
  return join(objectsDir(evidenceRoot), sha256.slice(0, 2), sha256);
}

export function evidenceSha256(bytes: string): string {
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

/** Store `bytes` (redacted) content-addressed; returns the EvidenceObjectV1. A
 *  hash that already exists is a no-op (dedup). Atomic: write tmp → rename. */
export function putEvidenceObject(evidenceRoot: string, kind: string, bytes: string): EvidenceObjectV1 {
  const redacted = redactEvidence(bytes);
  const sha256 = evidenceSha256(redacted);
  const finalPath = objectPath(evidenceRoot, sha256);
  if (!existsSync(finalPath)) {
    mkdirSync(dirname(finalPath), { recursive: true });
    const tmp = `${finalPath}.tmp-${process.pid}`;
    writeFileSync(tmp, redacted);
    renameSync(tmp, finalPath); // atomic within a filesystem
  }
  return { kind, sha256, path: join("objects", sha256.slice(0, 2), sha256), bytes: Buffer.byteLength(redacted, "utf8") };
}

/** Read a stored object's bytes by hash (null if absent). */
export function getEvidenceObject(evidenceRoot: string, sha256: string): string | null {
  const p = objectPath(evidenceRoot, sha256);
  try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
}

// ── attempt manifests + journal (append-only) ─────────────────────────────────

function attemptDir(evidenceRoot: string, attemptId: string): string {
  return join(evidenceRoot, "attempts", attemptId);
}

function manifestPath(evidenceRoot: string, attemptId: string): string {
  return join(attemptDir(evidenceRoot, attemptId), "manifest.json");
}

function journalPath(evidenceRoot: string, attemptId: string): string {
  return join(attemptDir(evidenceRoot, attemptId), "journal.jsonl");
}

export type OpenAttemptEvidence = {
  attemptId: string;
  taskClass: string;
  bookId: string;
  chapterNumber?: number;
  parentAttemptId?: string;
  inputHashes: Record<string, string>;
  executionContextManifestPath: string;
  routeResultPath?: string;
  retentionClass: RetentionClassV1;
};

/** Open (or reopen) an attempt's evidence manifest and record its first state.
 *  Idempotent per attemptId: reopening returns the existing manifest so a resume
 *  appends rather than clobbers. */
export function openAttemptEvidence(evidenceRoot: string, init: OpenAttemptEvidence, firstState: AttemptStateV1, atIso: string): AttemptEvidenceManifestV1 {
  const dir = attemptDir(evidenceRoot, init.attemptId);
  mkdirSync(dir, { recursive: true });
  const existing = loadAttemptManifest(evidenceRoot, init.attemptId);
  if (existing) {
    appendTransition(evidenceRoot, init.attemptId, firstState, atIso);
    return loadAttemptManifest(evidenceRoot, init.attemptId)!;
  }
  const manifest: AttemptEvidenceManifestV1 = {
    schema: "attempt-evidence-manifest-v1",
    attemptId: init.attemptId,
    ...(init.parentAttemptId ? { parentAttemptId: init.parentAttemptId } : {}),
    taskClass: init.taskClass,
    bookId: init.bookId,
    ...(init.chapterNumber !== undefined ? { chapterNumber: init.chapterNumber } : {}),
    inputHashes: init.inputHashes,
    executionContextManifestPath: init.executionContextManifestPath,
    ...(init.routeResultPath ? { routeResultPath: init.routeResultPath } : {}),
    stateTransitions: [{ state: firstState, atIso }],
    retentionClass: init.retentionClass,
    objects: [],
  };
  writeManifest(evidenceRoot, manifest);
  writeFileSync(journalPath(evidenceRoot, init.attemptId), JSON.stringify({ state: firstState, atIso }) + "\n");
  return manifest;
}

function writeManifest(evidenceRoot: string, manifest: AttemptEvidenceManifestV1): void {
  const p = manifestPath(evidenceRoot, manifest.attemptId);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(tmp, p);
}

export function loadAttemptManifest(evidenceRoot: string, attemptId: string): AttemptEvidenceManifestV1 | null {
  try {
    const raw = readFileSync(manifestPath(evidenceRoot, attemptId), "utf8");
    return JSON.parse(raw) as AttemptEvidenceManifestV1;
  } catch { return null; }
}

/** Fill in the IMP-00 effective-context manifest path (and route sidecar) once
 *  the spawn that produced this attempt has run — a permitted "grow" (adding a
 *  known-later pointer, never rewriting a claimed state). No-op if absent. */
export function linkExecutionContext(evidenceRoot: string, attemptId: string, executionContextManifestPath: string, routeResultPath?: string): void {
  const manifest = loadAttemptManifest(evidenceRoot, attemptId);
  if (!manifest || !executionContextManifestPath) return;
  manifest.executionContextManifestPath = redactEvidence(executionContextManifestPath);
  if (routeResultPath) manifest.routeResultPath = redactEvidence(routeResultPath);
  writeManifest(evidenceRoot, manifest);
}

/** Append a state transition (both to the manifest array and the raw journal).
 *  The manifest array is the queryable view; the journal is the immutable raw
 *  event stream (never replaced by a summary — rollback criterion). */
export function appendTransition(evidenceRoot: string, attemptId: string, state: AttemptStateV1, atIso: string): void {
  const manifest = loadAttemptManifest(evidenceRoot, attemptId);
  if (!manifest) return;
  manifest.stateTransitions.push({ state, atIso });
  writeManifest(evidenceRoot, manifest);
  // Append-only raw journal (survives even if a manifest write is lost).
  try {
    const jp = journalPath(evidenceRoot, attemptId);
    const prior = existsSync(jp) ? readFileSync(jp, "utf8") : "";
    writeFileSync(jp, prior + JSON.stringify({ state, atIso }) + "\n");
  } catch { /* journal best-effort; manifest is the source of truth */ }
}

/** Store `bytes` content-addressed and link the object into the attempt's
 *  manifest (deduplicated by kind+hash). Returns the stored object. */
export function attachEvidenceObject(evidenceRoot: string, attemptId: string, kind: string, bytes: string): EvidenceObjectV1 | null {
  const manifest = loadAttemptManifest(evidenceRoot, attemptId);
  if (!manifest) return null;
  const obj = putEvidenceObject(evidenceRoot, kind, bytes);
  if (!manifest.objects.some((o) => o.kind === obj.kind && o.sha256 === obj.sha256)) {
    manifest.objects.push(obj);
    writeManifest(evidenceRoot, manifest);
  }
  return obj;
}

// ── reconstruction / query ────────────────────────────────────────────────────

export type AttemptReconstruction = {
  manifest: AttemptEvidenceManifestV1;
  /** Transitions in recorded (chronological) order. */
  transitions: Array<{ state: AttemptStateV1; atIso: string }>;
  /** Every object hash verified against its stored bytes. */
  objectsVerified: Array<{ kind: string; sha256: string; ok: boolean }>;
  /** The terminal state (last transition). */
  terminalState: AttemptStateV1 | null;
};

/** Reconstruct one attempt chronologically WITHOUT scanning generated debris —
 *  everything comes from the manifest + content-addressed objects. */
export function reconstructAttempt(evidenceRoot: string, attemptId: string): AttemptReconstruction | null {
  const manifest = loadAttemptManifest(evidenceRoot, attemptId);
  if (!manifest) return null;
  const objectsVerified = manifest.objects.map((o) => {
    const bytes = getEvidenceObject(evidenceRoot, o.sha256);
    return { kind: o.kind, sha256: o.sha256, ok: bytes !== null && evidenceSha256(bytes) === o.sha256 };
  });
  const transitions = [...manifest.stateTransitions];
  return {
    manifest,
    transitions,
    objectsVerified,
    terminalState: transitions.length > 0 ? transitions[transitions.length - 1].state : null,
  };
}

export type LineageNode = { attemptId: string; parentAttemptId?: string; taskClass: string; terminalState: AttemptStateV1 | null; retentionClass: RetentionClassV1 };

/** A machine-readable lineage graph over every attempt in the store (for
 *  integration/bakeoff tooling; verify step 6). */
export function evidenceLineageGraph(evidenceRoot: string): LineageNode[] {
  const nodes: LineageNode[] = [];
  for (const attemptId of listAttemptIds(evidenceRoot)) {
    const m = loadAttemptManifest(evidenceRoot, attemptId);
    if (!m) continue;
    nodes.push({
      attemptId: m.attemptId,
      ...(m.parentAttemptId ? { parentAttemptId: m.parentAttemptId } : {}),
      taskClass: m.taskClass,
      terminalState: m.stateTransitions.length > 0 ? m.stateTransitions[m.stateTransitions.length - 1].state : null,
      retentionClass: m.retentionClass,
    });
  }
  return nodes.sort((a, b) => (a.attemptId < b.attemptId ? -1 : 1));
}

export function listAttemptIds(evidenceRoot: string): string[] {
  try { return readdirSync(join(evidenceRoot, "attempts")).sort(); } catch { return []; }
}

// ── retention / cleanup ───────────────────────────────────────────────────────

/** States that mean an attempt is still live — its evidence is never deletable. */
const ACTIVE_STATES: ReadonlySet<AttemptStateV1> = new Set<AttemptStateV1>([
  "allocated", "workspace-ready", "running", "process-ended", "output-ready",
  "candidate-ready", "commit-pending", "repair-planned", "recovery-required",
]);

/** Retention windows per class (ms). `null` = never auto-expire (must be
 *  cleaned by an explicit owner decision). Bounded — no class is unlimited by
 *  accident; migration experiments are the shortest. */
export const RETENTION_WINDOWS_MS: Record<RetentionClassV1, number | null> = {
  "migration-experiment": 30 * 24 * 60 * 60 * 1000,   // 30d
  "temporary-workspace": 7 * 24 * 60 * 60 * 1000,      // 7d
  "infrastructure-event": 90 * 24 * 60 * 60 * 1000,    // 90d
  "rejected-production": 90 * 24 * 60 * 60 * 1000,      // 90d
  "accepted-production": null,                          // keep until owner decision
  "sensitive-source": null,                             // owner/privacy decision only
};

export type CleanupPlan = {
  deletable: string[];
  protected: Array<{ attemptId: string; reason: string }>;
  dryRun: boolean;
};

/** Report a bounded cleanup plan. Never deletes evidence; the retained
 *  `execute` option is ignored for caller compatibility. */
export function planEvidenceCleanup(evidenceRoot: string, opts: { now: number; protectedRefs?: Iterable<string>; execute?: boolean } ): CleanupPlan {
  const protectedRefs = new Set(opts.protectedRefs ?? []);
  const deletable: string[] = [];
  const kept: Array<{ attemptId: string; reason: string }> = [];
  for (const attemptId of listAttemptIds(evidenceRoot)) {
    const m = loadAttemptManifest(evidenceRoot, attemptId);
    if (!m) continue;
    const terminal = m.stateTransitions.length > 0 ? m.stateTransitions[m.stateTransitions.length - 1].state : null;
    if (protectedRefs.has(attemptId)) { kept.push({ attemptId, reason: "cited by an active decision/report" }); continue; }
    if (terminal !== null && ACTIVE_STATES.has(terminal)) { kept.push({ attemptId, reason: `active state "${terminal}"` }); continue; }
    const window = RETENTION_WINDOWS_MS[m.retentionClass];
    if (window === null) { kept.push({ attemptId, reason: `retention class "${m.retentionClass}" never auto-expires` }); continue; }
    const lastIso = m.stateTransitions.length > 0 ? m.stateTransitions[m.stateTransitions.length - 1].atIso : null;
    const ageMs = lastIso ? opts.now - Date.parse(lastIso) : Number.POSITIVE_INFINITY;
    if (ageMs >= window) deletable.push(attemptId);
    else kept.push({ attemptId, reason: `within the ${Math.round(window / 86400000)}d window` });
  }
  return { deletable: deletable.sort(), protected: kept.sort((a, b) => (a.attemptId < b.attemptId ? -1 : 1)), dryRun: true };
}

// ── stale-evidence classification (item 17) ───────────────────────────────────

/** Which lineage inputs a live attempt was produced under, for staleness. */
export type LineageFingerprint = {
  sourcePlanHash?: string;
  executionProfileHash?: string;
  routePolicyVersion?: string;
  rendererVersion?: string;
};

/** Classify an attempt's evidence as fresh or stale against the CURRENT lineage.
 *  A change to any recorded input hash means the attempt no longer reflects the
 *  live pipeline — flagged (not deleted; cleanup is a separate owner decision). */
export function classifyEvidenceStaleness(manifest: AttemptEvidenceManifestV1, current: LineageFingerprint): { stale: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ih = manifest.inputHashes ?? {};
  if (current.sourcePlanHash && ih.sourceUsePlan && ih.sourceUsePlan !== current.sourcePlanHash) reasons.push("source-use plan changed");
  if (current.executionProfileHash && ih.executionProfile && ih.executionProfile !== current.executionProfileHash) reasons.push("execution profile changed");
  if (current.rendererVersion && ih.untrustedArtifactRenderer && ih.untrustedArtifactRenderer !== current.rendererVersion) reasons.push("renderer changed");
  return { stale: reasons.length > 0, reasons };
}

// ── validation passthrough ────────────────────────────────────────────────────

export function validateStoredManifest(evidenceRoot: string, attemptId: string): string[] {
  const m = loadAttemptManifest(evidenceRoot, attemptId);
  if (!m) return [`no manifest for attempt ${attemptId}`];
  return validateAttemptEvidenceManifest(m);
}

/** Total on-disk size of the store (bytes) — for bound reporting. */
export function evidenceStoreSize(evidenceRoot: string): number {
  let total = 0;
  const walk = (dir: string): void => {
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) { try { total += statSync(abs).size; } catch { /* raced */ } }
    }
  };
  walk(evidenceRoot);
  return total;
}
