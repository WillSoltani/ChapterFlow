/**
 * Export-completeness manifest (#3) — pure builder.
 *
 * The GDPR/CCPA data export keeps-and-flags: a per-source read that fails (its
 * `.catch` fallback fires) or that hits a pagination hard cap does NOT abort the
 * export — the file is still returned, but a `manifest` tells the truth about
 * which sources are complete. Without this, a silently-truncated or
 * silently-empty source looked identical to a genuinely-empty one, so a user
 * could receive a partial "all your data" artifact believing it was complete.
 *
 * Dependency-free so it is unit testable and emitted identically across
 * json/csv/markdown.
 */

/** One per-source completeness record. */
export type ExportSourceStatus = {
  /** Stable source name (e.g. "analyticsEvents", "flowPointsLedger"). */
  name: string;
  /** Number of records exported for this source. */
  count: number;
  /**
   * True iff the source was read successfully AND in full. False when the read
   * failed (fallback fired) or a pagination cap truncated it.
   */
  complete: boolean;
  /** Optional machine-readable reason a source is incomplete. */
  reason?: "read_failed" | "truncated" | undefined;
};

export type ExportManifest = {
  /** ISO timestamp the manifest was built. */
  generatedAt: string;
  /** Per-source name → exported count. */
  counts: Record<string, number>;
  /** True iff EVERY source is complete. */
  complete: boolean;
  /** Names of the sources that are NOT complete (empty when complete). */
  partialSources: string[];
  /** Per-source detail (name, count, complete, reason). */
  sources: ExportSourceStatus[];
};

/**
 * Build the manifest from the per-source statuses. `complete` is the AND of all
 * sources; `partialSources` lists every incomplete one (sorted for stable
 * output across formats).
 */
export function buildExportManifest(
  sources: ExportSourceStatus[],
  generatedAt: string,
): ExportManifest {
  const counts: Record<string, number> = {};
  const partialSources: string[] = [];
  for (const s of sources) {
    counts[s.name] = s.count;
    if (!s.complete) partialSources.push(s.name);
  }
  partialSources.sort();
  return {
    generatedAt,
    counts,
    complete: partialSources.length === 0,
    partialSources,
    sources,
  };
}

/**
 * Collects per-source statuses while the export reads each source, then builds
 * the manifest. Each source is recorded exactly once via `record`. Use
 * `runSource` to wrap a read so a thrown/rejected read is caught here (the
 * `.catch` no longer needs to live at the call site and stay silent).
 */
export class ExportSourceTracker {
  private readonly statuses: ExportSourceStatus[] = [];

  /** Record a source's outcome explicitly. */
  record(status: ExportSourceStatus): void {
    this.statuses.push(status);
  }

  /**
   * Run a source read that returns `{ items, truncated? }` (or a plain array),
   * recording its completeness. On rejection, records read_failed and returns
   * the supplied fallback so the export still succeeds.
   */
  async runSource<T>(
    name: string,
    read: () => Promise<T[] | { items: T[]; truncated?: boolean }>,
    fallback: T[],
  ): Promise<T[]> {
    try {
      const result = await read();
      const items = Array.isArray(result) ? result : result.items;
      const truncated = Array.isArray(result) ? false : result.truncated === true;
      this.record({
        name,
        count: items.length,
        complete: !truncated,
        reason: truncated ? "truncated" : undefined,
      });
      return items;
    } catch {
      this.record({ name, count: fallback.length, complete: false, reason: "read_failed" });
      return fallback;
    }
  }

  /**
   * Run a SCALAR (single-object) source read, recording its completeness so a
   * silently-caught read failure is reflected in the manifest instead of being
   * emitted as an indistinguishable null/empty value. On rejection, records
   * read_failed and returns the supplied fallback so the export still succeeds.
   * `count` is 1 when a value is present, 0 when null/undefined (or on failure).
   */
  async runScalar<T>(
    name: string,
    read: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      const value = await read();
      this.record({ name, count: value == null ? 0 : 1, complete: true });
      return value;
    } catch {
      this.record({ name, count: 0, complete: false, reason: "read_failed" });
      return fallback;
    }
  }

  build(generatedAt: string): ExportManifest {
    return buildExportManifest(this.statuses, generatedAt);
  }
}
