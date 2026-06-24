/**
 * Pure classification of the dashboard's fan-out reads into CRITICAL vs OPTIONAL,
 * extracted so the fail-loud / degrade-gracefully decision is unit-testable
 * without DynamoDB. (#2)
 *
 * - **Critical** sources (catalog, entitlement, progress, bookStates,
 *   chapterStates) define whether the dashboard can be trusted at all. If ANY
 *   critical read failed the route must fail LOUD with a 503 so the client shows
 *   a retryable error state — it must never collapse a missing entitlement to a
 *   false FREE plan.
 * - **Optional** sources (badges, points, saved, readingDays, settings, profile)
 *   degrade gracefully: the dashboard still renders, but the payload carries
 *   `partial: true` + a `warnings` list naming which optional sources failed so
 *   the client can surface a "couldn't load everything" banner.
 */

/** The canonical critical source names, in a stable order for `warnings`. */
export const CRITICAL_DASHBOARD_SOURCES = [
  "catalog",
  "entitlement",
  "progress",
  "bookStates",
  "chapterStates",
] as const;

/** The canonical optional source names, in a stable order for `warnings`. */
export const OPTIONAL_DASHBOARD_SOURCES = [
  "settings",
  "profile",
  "saved",
  "readingDays",
  "badgeAwards",
  "insightPoints",
] as const;

export type CriticalDashboardSource = (typeof CRITICAL_DASHBOARD_SOURCES)[number];
export type OptionalDashboardSource = (typeof OPTIONAL_DASHBOARD_SOURCES)[number];
export type DashboardSource = CriticalDashboardSource | OptionalDashboardSource;

/** Map of source name → whether that read SUCCEEDED. */
export type DashboardSourceOutcomes = Partial<Record<DashboardSource, boolean>>;

export type DashboardSplitDecision = {
  /** True when every critical source succeeded — safe to serve. */
  ok: boolean;
  /** Critical sources that failed (empty when `ok`), in canonical order. */
  failedCritical: CriticalDashboardSource[];
  /** True when at least one OPTIONAL source failed (only meaningful when ok). */
  partial: boolean;
  /** Optional sources that failed, in canonical order — surfaced to the client. */
  warnings: OptionalDashboardSource[];
};

/**
 * Classify the per-source success/failure outcomes. A source absent from
 * `outcomes` is treated as failed (defensive: a missing entry must never be read
 * as success). When any critical source failed `ok` is false and the caller
 * should throw `BookApiError(503, "dashboard_unavailable")`.
 */
export function classifyDashboardReads(
  outcomes: DashboardSourceOutcomes,
): DashboardSplitDecision {
  const failedCritical = CRITICAL_DASHBOARD_SOURCES.filter(
    (name) => outcomes[name] !== true,
  );
  const warnings = OPTIONAL_DASHBOARD_SOURCES.filter((name) => outcomes[name] !== true);
  const ok = failedCritical.length === 0;
  return {
    ok,
    failedCritical,
    partial: ok && warnings.length > 0,
    warnings,
  };
}
