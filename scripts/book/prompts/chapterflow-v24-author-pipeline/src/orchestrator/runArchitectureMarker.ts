/**
 * Run-architecture marker (WP-201).
 *
 * The default conductor architecture flipped from the v23 compiler to v24 author. A book
 * that was already MID-RUN under one architecture must not have its resume SILENTLY switched
 * to another by the default flip — different architectures leave incompatible in-progress
 * state (compiler section artifacts vs whole-chapter author drafts), so a silent switch can
 * strand or corrupt a partial run.
 *
 * Resume metadata did NOT previously record which architecture a run used (the autopilot
 * resumes purely from derived BookStatus — chapters written/gated/qc'd — with no run-level
 * architecture field anywhere). Per the WP-201 charter, we therefore RECORD it from now on
 * and treat ABSENCE as author-ok: books that predate this marker have no recorded
 * architecture, so the default (author) resume proceeds for them without a false halt.
 *
 * Guard semantics (see `guardResumeArchitecture` / `decideResumeArchitecture`):
 *   - no marker            → author-ok: proceed and record the selected architecture.
 *   - marker == selected   → proceed (idempotent record).
 *   - marker != selected, explicit architecture flag passed → conscious switch: allow and
 *                            re-record (the switch is no longer silent — the operator asked).
 *   - marker != selected, NO explicit flag (the default did the switching) → FAIL CLOSED with
 *                            a message telling the operator to pass the explicit flag.
 *
 * The marker lives under the pipeline's own canonical state (never the forbidden repo-root
 * shadow) at `state/books/<bookId>/run-architecture.json`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { CANONICAL_STATE } from "../lib/chapterPaths.js";

export type ConductorArchitecture = "compiler" | "legacy" | "author";

export const RUN_ARCHITECTURE_MARKER_SCHEMA = "run-architecture-v1" as const;

export type RunArchitectureMarkerV1 = {
  schemaVersion: typeof RUN_ARCHITECTURE_MARKER_SCHEMA;
  bookId: string;
  architecture: ConductorArchitecture;
  recordedAt: string;
};

/** The flag an operator passes to explicitly re-select each architecture (used in the
 *  fail-closed guard message so the remedy is copy-pasteable). */
const ARCHITECTURE_FLAG: Record<ConductorArchitecture, string> = {
  author: "--author",
  compiler: "--compiler",
  legacy: "--legacy",
};

function isConductorArchitecture(value: unknown): value is ConductorArchitecture {
  return value === "compiler" || value === "legacy" || value === "author";
}

export function runArchitectureMarkerPath(bookId: string, stateRoot: string = CANONICAL_STATE): string {
  return resolve(stateRoot, "books", bookId, "run-architecture.json");
}

/** The architecture recorded for a book's in-progress run, or `null` when no valid marker
 *  exists. Absence-safe: a missing OR unreadable/malformed marker reads as `null` (author-ok),
 *  so a corrupt marker never wedges a run — it degrades to the documented default. */
export function readRunArchitecture(bookId: string, stateRoot?: string): ConductorArchitecture | null {
  const p = runArchitectureMarkerPath(bookId, stateRoot);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<RunArchitectureMarkerV1>;
    if (raw?.schemaVersion !== RUN_ARCHITECTURE_MARKER_SCHEMA) return null;
    return isConductorArchitecture(raw.architecture) ? raw.architecture : null;
  } catch {
    return null;
  }
}

export function recordRunArchitecture(bookId: string, architecture: ConductorArchitecture, stateRoot?: string): void {
  const p = runArchitectureMarkerPath(bookId, stateRoot);
  mkdirSync(dirname(p), { recursive: true });
  const marker: RunArchitectureMarkerV1 = {
    schemaVersion: RUN_ARCHITECTURE_MARKER_SCHEMA,
    bookId,
    architecture,
    recordedAt: new Date().toISOString(),
  };
  writeFileSync(p, JSON.stringify(marker, null, 2) + "\n", "utf8");
}

export type ResumeArchitectureDecision =
  | { ok: true; action: "record" | "proceed" | "switch" }
  | { ok: false; message: string };

/** Pure decision (no I/O) so the guard is exhaustively unit-testable. Given the recorded
 *  architecture (or null), the selected architecture, and whether an explicit flag chose it,
 *  return whether the run may proceed and, if not, the fail-closed operator message. */
export function decideResumeArchitecture(input: {
  bookId: string;
  selected: ConductorArchitecture;
  recorded: ConductorArchitecture | null;
  explicit: boolean;
}): ResumeArchitectureDecision {
  const { bookId, selected, recorded, explicit } = input;
  if (recorded === null) return { ok: true, action: "record" };
  if (recorded === selected) return { ok: true, action: "proceed" };
  if (explicit) return { ok: true, action: "switch" };
  return {
    ok: false,
    message:
      `book "${bookId}" has in-progress state from a previous run under the ${recorded} architecture, ` +
      `but with no architecture flag the default now resolves to ${selected}. Resuming would SILENTLY ` +
      `switch architectures and can strand or corrupt the partial run. Re-run with ` +
      `${ARCHITECTURE_FLAG[recorded]} to continue under ${recorded}, or ${ARCHITECTURE_FLAG[selected]} ` +
      `to deliberately switch to ${selected}.`,
  };
}

/** Read the marker, decide, and — on any ok path — (re)record the selected architecture so
 *  future resumes are consistent. Returns the fail-closed message when a silent switch is
 *  refused. Callers must NOT invoke this for a dry-run (`--plan`), which takes no action and
 *  must write nothing. */
export function guardResumeArchitecture(input: {
  bookId: string;
  selected: ConductorArchitecture;
  explicit: boolean;
  stateRoot?: string;
}): { ok: true } | { ok: false; message: string } {
  const recorded = readRunArchitecture(input.bookId, input.stateRoot);
  const decision = decideResumeArchitecture({
    bookId: input.bookId,
    selected: input.selected,
    recorded,
    explicit: input.explicit,
  });
  if (!decision.ok) return { ok: false, message: decision.message };
  recordRunArchitecture(input.bookId, input.selected, input.stateRoot);
  return { ok: true };
}
