/**
 * WS6 T1/T2 — conductor telemetry: an in-memory per-run session ledger that turns
 * the §1.1 forensic cost-accounting table into a machine artifact instead of an
 * archaeology project.
 *
 * WHY THIS EXISTS. The first v24 production run's TRUE cost was 102 sessions vs the
 * ~35 that were easy to read off the logs, and it had to be reconstructed by counting
 * the conductor's per-process session-id suffix (autopilot.ts defaultMkSessionId's
 * `sessionCounter`). Two deterministic gate-repair spawns were proven to exist ONLY by
 * that counter arithmetic — id -50 with 49 logged lines — because their spawn site
 * emitted no per-shard log line on the ahead-of-checkout run binary.
 *
 * The ledger closes that gap two ways:
 *   1. It observes EVERY minted session id (mkSessionId) AND every spawned session's
 *      outcome (logSession) at the single deps choke points, so both are captured no
 *      matter which module (autopilot / author / compiler / polish / evidence) spawned.
 *   2. The HONEST-ACCOUNTING INVARIANT: every minted id that is a real agent SPAWN must
 *      have a matching logged outcome. A minted-but-never-logged spawn id is exactly the
 *      "hidden session" defect; the report prints a loud ERROR line (it never halts — a
 *      telemetry gap must never brick a run).
 *
 * VERB-ONLY ids (finalize / publish-finalize) mint an id for a `runVerb` env var and
 * NEVER spawn a codex agent, so they legitimately never log. They are classified as a
 * non-spawn `verb` type and excluded from the spawn-vs-log reconciliation.
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import type { AutopilotPhase } from "./autopilot.js";
import type { CodexAgentResult } from "./codexAgent.js";

export const SESSION_LEDGER_SCHEMA = "autopilot-cost-report-v1" as const;
export const RUN_MANIFEST_SCHEMA = "autopilot-run-manifest-v1" as const;

/** The coarse session TYPE, derived from the mkSessionId label. `verb` is the ONLY
 *  non-spawn type (an id minted for a runVerb env var, never a codex agent). */
export type SessionType =
  | "research"
  | "source-repair"
  | "writer"
  | "gate-repair"
  | "major-repair"
  | "shadow-review"
  | "variety-scout"
  | "readiness-scout"
  | "qc-review"
  | "qc-repair"
  | "acceptance-reader"
  | "author-review"
  | "author-book-reader"
  | "key"
  | "sweep"
  | "shipped-control"
  | "verb"
  | "other";

/** One minted session id and (once its agent returns) its logged outcome. */
export type SessionRecord = {
  sessionId: string;
  label: string;
  type: SessionType;
  phase: AutopilotPhase;
  /** True once a matching logSession outcome was observed. verb-type stays false. */
  logged: boolean;
  ok?: boolean;
  exitCode?: number;
  durationMs?: number;
  /** A short retry/repair cause parsed from the label (e.g. `retry1`, `attempt-2`). */
  cause?: string;
};

/** The set of label PREFIXES that mint an id for a runVerb call, not an agent spawn.
 *  These legitimately never call logSession. Keep in sync with autopilot.ts's
 *  `mkSessionId` sites that flow into `runVerb({ CHAPTERFLOW_SESSION_ID })`. */
const VERB_ONLY_LABELS = new Set(["finalize", "publish-finalize"]);

/** Map a mkSessionId label to a coarse SessionType. Order matters — the first match
 *  wins, so more specific families (author-book-reader before author-review before a
 *  bare `qc-` reviewer) are tested first. */
export function classifySessionLabel(label: string): SessionType {
  const l = label.toLowerCase();
  if (VERB_ONLY_LABELS.has(l)) return "verb";
  if (l.startsWith("research")) return "research";
  // Source-sidecar repair, both the legacy/author `source-repair-N` and the compiler
  // `compiler-source-repair-N`.
  if (l.startsWith("source-repair") || l.startsWith("compiler-source-repair")) return "source-repair";
  if (l.startsWith("gate-major-repair")) return "major-repair";
  if (l.startsWith("gate-repair")) return "gate-repair";
  if (l.startsWith("qc-shadow-review")) return "shadow-review";
  if (l.startsWith("pre-qc-variety")) return "variety-scout";
  if (l.startsWith("pre-qc-readiness")) return "readiness-scout";
  if (l.startsWith("qc-converge-fix") || l.startsWith("qc-regression-fix") || l.startsWith("compiler-section-repair")) return "qc-repair";
  if (l.startsWith("shipped-control")) return "shipped-control";
  if (l.startsWith("author-book-reader")) return "author-book-reader";
  if (l.startsWith("author-review")) return "author-review";
  // Evidence: `author-key-keyA/keyB` and the QC reviewer `qc-keyA/keyB`.
  if (l.includes("key")) return "key";
  // Evidence + reviewer sweep: `author-sweep[-retry]`, `qc-sweep`.
  if (l.includes("sweep")) return "sweep";
  // Whole-chapter / section / assembly WRITERS: legacy `write-chNN`, v24 author
  // `author-chNN[-retryN]`, compiler `section-<kind>-chNN` + `compiler-assembly-chNN`.
  // (author-review / author-book-reader already returned above, so a bare `author-ch`
  // here is a writer, not a reader.)
  if (l.startsWith("write-ch") || /^author-ch\d/.test(l) || l.startsWith("section-") || l.startsWith("compiler-assembly")) return "writer";
  // Acceptance book readers on the legacy/compiler path use the book-reader label.
  if (l.includes("book-reader")) return "acceptance-reader";
  // QC reviewer roles are minted as `qc-<role>` (bar/confirm/major) + a `-fix` variant.
  if (l.startsWith("qc-")) return "qc-review";
  return "other";
}

/** Parse a compact retry/attempt cause from a label so the report can bucket retries.
 *  Returns undefined for a first-attempt / causeless label. */
export function parseCause(label: string): string | undefined {
  const l = label.toLowerCase();
  const retry = l.match(/retry(\d+)/);
  if (retry) return `retry${retry[1]}`;
  const attempt = l.match(/attempt-?(\d+)/);
  if (attempt) return `attempt-${attempt[1]}`;
  const repair = l.match(/(gate-repair|gate-major-repair|qc-converge-fix|qc-regression-fix)-(\d+)/);
  if (repair) return `${repair[1]}-${repair[2]}`;
  const r2 = l.match(/-r2\b/);
  if (r2) return "respawn";
  return undefined;
}

export type CarryTally = { hits: number; misses: number };

export type CostReport = {
  schemaVersion: typeof SESSION_LEDGER_SCHEMA;
  bookId: string;
  terminal: string; // "ready" | "published" | "shipped" | "halt:<category>" | "error"
  at: string;
  grandTotalSessions: number; // spawns only (verb ids excluded)
  mintedIds: number; // every mkSessionId call, incl. verb ids
  verbIds: number;
  byType: Record<string, number>;
  byPhase: Record<string, number>;
  retriesByCause: Record<string, number>;
  carry: CarryTally;
  wallClockMsByPhase: Record<string, number>;
  totalWallClockMs: number;
  /** Honest-accounting invariant: spawn ids that minted but never logged (the hidden
   *  session defect). Empty ⇒ clean. */
  unloggedSpawnIds: string[];
  invariantOk: boolean;
  sessions: SessionRecord[];
};

/** A per-run session ledger. One instance per runAutopilot call. */
export class SessionLedger {
  readonly bookId: string;
  private readonly records: SessionRecord[] = [];
  private readonly byId = new Map<string, SessionRecord>();
  private phase: AutopilotPhase = "research";
  private mintedCount = 0;
  private readonly carry: CarryTally = { hits: 0, misses: 0 };
  // Wall-clock per phase: accumulate each logged session's durationMs into the phase
  // it was minted in (a robust, spawn-cost-weighted proxy that needs no wall timer and
  // survives interleaved parallelism).
  private readonly phaseWallMs: Record<string, number> = {};

  constructor(bookId: string) {
    this.bookId = bookId;
  }

  setPhase(phase: AutopilotPhase): void {
    this.phase = phase;
  }

  /** Record a minted session id (called for EVERY deps.mkSessionId). */
  mint(label: string, sessionId: string): void {
    this.mintedCount += 1;
    const rec: SessionRecord = {
      sessionId,
      label,
      type: classifySessionLabel(label),
      phase: this.phase,
      logged: false,
      cause: parseCause(label),
    };
    this.records.push(rec);
    // Last-writer-wins on id collision is fine — ids are unique per process by the
    // counter suffix, so this only ever inserts.
    this.byId.set(sessionId, rec);
  }

  /** Record a spawned session's outcome (called for EVERY deps.logSession). Matches the
   *  minted record by the result's sessionId; if the id was never minted through THIS
   *  ledger (e.g. a stub that fabricated an id) it is still captured as a logged record
   *  so the count stays honest. */
  record(r: CodexAgentResult): void {
    const rec = this.byId.get(r.sessionId);
    if (rec) {
      rec.logged = true;
      rec.ok = r.ok;
      rec.exitCode = r.exitCode;
      rec.durationMs = r.durationMs;
    } else {
      const synth: SessionRecord = {
        sessionId: r.sessionId,
        label: r.sessionId,
        type: classifySessionLabel(r.sessionId),
        phase: this.phase,
        logged: true,
        ok: r.ok,
        exitCode: r.exitCode,
        durationMs: r.durationMs,
      };
      this.records.push(synth);
      this.byId.set(r.sessionId, synth);
    }
    const ms = Number.isFinite(r.durationMs) ? r.durationMs : 0;
    const ph = (rec ?? this.byId.get(r.sessionId))!.phase;
    this.phaseWallMs[ph] = (this.phaseWallMs[ph] ?? 0) + ms;
  }

  carryHit(): void { this.carry.hits += 1; }
  carryMiss(): void { this.carry.misses += 1; }

  /** The mkSessionId counter value the invariant reconciles against. */
  get mintedIds(): number { return this.mintedCount; }

  /** Spawn ids (non-verb) that minted but were never logged — the hidden-session defect. */
  unloggedSpawnIds(): string[] {
    return this.records.filter((r) => r.type !== "verb" && !r.logged).map((r) => r.sessionId);
  }

  build(terminal: string): CostReport {
    const spawns = this.records.filter((r) => r.type !== "verb");
    const byType: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const retriesByCause: Record<string, number> = {};
    for (const r of spawns) {
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
      if (r.cause) retriesByCause[r.cause] = (retriesByCause[r.cause] ?? 0) + 1;
    }
    const unlogged = this.unloggedSpawnIds();
    const totalWall = Object.values(this.phaseWallMs).reduce((s, n) => s + n, 0);
    return {
      schemaVersion: SESSION_LEDGER_SCHEMA,
      bookId: this.bookId,
      terminal,
      at: new Date().toISOString(),
      grandTotalSessions: spawns.length,
      mintedIds: this.mintedCount,
      verbIds: this.records.filter((r) => r.type === "verb").length,
      byType,
      byPhase,
      retriesByCause,
      carry: { ...this.carry },
      wallClockMsByPhase: { ...this.phaseWallMs },
      totalWallClockMs: totalWall,
      unloggedSpawnIds: unlogged,
      invariantOk: unlogged.length === 0,
      sessions: this.records.map((r) => ({ ...r })),
    };
  }
}

/** A compact human table for the READY/HALT/error print. */
export function formatCostReport(rep: CostReport): string {
  const lines: string[] = [];
  lines.push(`── cost report — ${rep.bookId} [${rep.terminal}] ──`);
  lines.push(`  grand total spawns: ${rep.grandTotalSessions}  (minted ids ${rep.mintedIds}; verb ids ${rep.verbIds})`);
  const typeRows = Object.entries(rep.byType).sort((a, b) => b[1] - a[1]);
  if (typeRows.length) lines.push(`  by type: ${typeRows.map(([k, v]) => `${k}:${v}`).join("  ")}`);
  const phaseRows = Object.entries(rep.byPhase).sort((a, b) => b[1] - a[1]);
  if (phaseRows.length) lines.push(`  by phase: ${phaseRows.map(([k, v]) => `${k}:${v}`).join("  ")}`);
  const causeRows = Object.entries(rep.retriesByCause).sort((a, b) => b[1] - a[1]);
  if (causeRows.length) lines.push(`  retries by cause: ${causeRows.map(([k, v]) => `${k}:${v}`).join("  ")}`);
  lines.push(`  carry: ${rep.carry.hits} hit / ${rep.carry.misses} miss`);
  const wallRows = Object.entries(rep.wallClockMsByPhase).sort((a, b) => b[1] - a[1]);
  if (wallRows.length) lines.push(`  wall (spawn ms) by phase: ${wallRows.map(([k, v]) => `${k}:${Math.round(v)}`).join("  ")}  total:${Math.round(rep.totalWallClockMs)}`);
  if (!rep.invariantOk) {
    lines.push(`  ERROR honest-accounting invariant TRIPPED: ${rep.unloggedSpawnIds.length} spawn id(s) minted but never logged — a hidden/unlogged spawn exists: ${rep.unloggedSpawnIds.slice(0, 8).join(", ")}`);
  }
  return lines.join("\n");
}

/** Persist the cost report to state/autopilot-logs/<book>/cost-report.json. Best-effort:
 *  a telemetry write must never brick a run. */
export function writeCostReport(pipelineDir: string, bookId: string, rep: CostReport): string | null {
  try {
    const dir = resolve(pipelineDir, "state", "autopilot-logs", bookId);
    mkdirSync(dir, { recursive: true });
    const path = resolve(dir, "cost-report.json");
    writeFileSync(path, `${JSON.stringify(rep, null, 2)}\n`, "utf8");
    return path;
  } catch {
    return null;
  }
}

// ── T2 — run manifest ────────────────────────────────────────────────────────

export type RunManifest = {
  schemaVersion: typeof RUN_MANIFEST_SCHEMA;
  bookId: string;
  arch: "compiler" | "legacy" | "author";
  flags: Record<string, unknown>;
  bar: number | null;
  readerCount: number | null;
  beatShipped: { pin: string | null; composite: number | null } | null;
  startedAt: string;
  finishedAt: string | null;
  terminal: string | null;
  packageSha: string | null;
  packageSize: number | null;
};

export function newRunManifest(args: {
  bookId: string;
  arch: "compiler" | "legacy" | "author";
  flags: Record<string, unknown>;
  bar?: number | null;
  readerCount?: number | null;
}): RunManifest {
  return {
    schemaVersion: RUN_MANIFEST_SCHEMA,
    bookId: args.bookId,
    arch: args.arch,
    flags: args.flags,
    bar: args.bar ?? null,
    readerCount: args.readerCount ?? null,
    beatShipped: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    terminal: null,
    packageSha: null,
    packageSize: null,
  };
}

/** Persist the manifest to state/autopilot-logs/<book>/run-manifest.json. Best-effort. */
export function writeRunManifest(pipelineDir: string, manifest: RunManifest): string | null {
  try {
    const dir = resolve(pipelineDir, "state", "autopilot-logs", manifest.bookId);
    mkdirSync(dir, { recursive: true });
    const path = resolve(dir, "run-manifest.json");
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return path;
  } catch {
    return null;
  }
}
