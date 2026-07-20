import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import type { PortError, Result } from "../contracts/v4Core.js";
import type { LibraryState, LibraryStateOptions } from "../librarian/libraryState.js";

export const LEGACY_LIBRARIAN_WRITER_ENV = "CHAPTERFLOW_LEGACY_LIBRARIAN_WRITER_ENABLED";

export type LibrarianStateErrorCode =
  | "LIBRARIAN_STATE_MISSING"
  | "LIBRARIAN_STATE_CORRUPT"
  | "LIBRARIAN_STATE_STALE";

export type LibrarianStateError = PortError & { readonly code: LibrarianStateErrorCode };

export type LibrarianStateView = Readonly<{
  state: LibraryState;
  ledgerPath: string;
}>;

export type LibrarianStateComparison = Readonly<{
  matched: boolean;
  selected: "LEGACY";
  legacy: LibrarianStateView;
  shadow: LibrarianStateView;
  mismatch: string | null;
}>;

function failed<T>(code: LibrarianStateErrorCode, message: string): Result<T, LibrarianStateError> {
  return { ok: false, error: { code, message, retryable: false } };
}

function within(base: string, target: string): boolean {
  const rel = relative(resolve(base), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function semanticState(state: LibraryState): string {
  const { lastUpdatedAt: _lastUpdatedAt, revision: _revision, ...meaning } = state;
  return JSON.stringify(canonical(meaning));
}

export function assertV4LibrarianWriterPreflight(legacyWriterEnabled?: boolean): void {
  const enabled = legacyWriterEnabled ?? process.env[LEGACY_LIBRARIAN_WRITER_ENV] === "1";
  if (enabled) {
    throw new Error(
      `V4 librarian write blocked: legacy same-book writer is enabled (${LEGACY_LIBRARIAN_WRITER_ENV}=1)`,
    );
  }
}

/** Compatibility read only. Missing/corrupt/stale meaning belongs here, not in legacy loader. */
export async function loadLegacyLibrarianStateView(
  opts: LibraryStateOptions & { requireFresh?: boolean } = {},
): Promise<Result<LibrarianStateView, LibrarianStateError>> {
  const stateDir = resolve(opts.stateDir ?? resolve(process.cwd(), "state"));
  const ledgerPath = resolve(opts.ledgerPath ?? resolve(stateDir, "library-state.json"));
  if (!existsSync(ledgerPath)) return failed("LIBRARIAN_STATE_MISSING", `library state missing at ${ledgerPath}`);
  try {
    JSON.parse(readFileSync(ledgerPath, "utf8"));
  } catch (cause) {
    return failed("LIBRARIAN_STATE_CORRUPT", `library state corrupt at ${ledgerPath}: ${(cause as Error).message}`);
  }

  try {
    const { loadLibraryState, verifyLibraryState } = await import("../librarian/libraryState.js");
    const state = loadLibraryState({ ...opts, stateDir, ledgerPath });
    if (opts.requireFresh) {
      const report = verifyLibraryState({ ...opts, stateDir, ledgerPath });
      if (report.drift) return failed("LIBRARIAN_STATE_STALE", report.differences.join("; "));
    }
    return { ok: true, value: { state, ledgerPath } };
  } catch (cause) {
    return failed("LIBRARIAN_STATE_CORRUPT", `library state corrupt at ${ledgerPath}: ${(cause as Error).message}`);
  }
}

export async function compareLegacyLibrarianState(
  input: Readonly<{
    legacyStateDir: string;
    shadowStateDir: string;
    disposableRoot: string;
  }>,
): Promise<Result<LibrarianStateComparison, LibrarianStateError>> {
  if (!within(input.disposableRoot, input.shadowStateDir)) {
    throw new Error("librarian shadow state must be within disposableRoot");
  }
  if (within(input.legacyStateDir, input.shadowStateDir) || within(input.shadowStateDir, input.legacyStateDir)) {
    throw new Error("librarian shadow state must be distinct from legacy state");
  }
  const legacy = await loadLegacyLibrarianStateView({ stateDir: input.legacyStateDir });
  if (!legacy.ok) return legacy;
  const shadow = await loadLegacyLibrarianStateView({ stateDir: input.shadowStateDir });
  if (!shadow.ok) return shadow;
  const matched = semanticState(legacy.value.state) === semanticState(shadow.value.state);
  return {
    ok: true,
    value: {
      matched,
      selected: "LEGACY",
      legacy: legacy.value,
      shadow: shadow.value,
      mismatch: matched ? null : "normalized librarian state meaning differs",
    },
  };
}
