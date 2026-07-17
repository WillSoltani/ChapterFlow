/**
 * WP-E42 (V25-NEW-06) — versioned price-table contract.
 *
 * WHY THIS EXISTS. `runCallLedger.ts` deliberately never fabricates a dollar
 * figure: `cost` is always the `NOT_METERED` marker, because the codex-exec
 * route is subscription-billed and the D7 rater/adjudicator route carries no
 * observable token count. A COST *ESTIMATE* is still useful for ordering
 * screening runs, but only when it is priced against a table the owner has
 * actually signed off on — never a guessed or copy-pasted number.
 *
 * This module owns that gate. `config/price-table.v1.json` is NOT shipped —
 * only `config/price-table.v1.example.json` ships, and it carries
 * `ownerApproved: false` so it can never be loaded by a copy-paste accident
 * (a caller who copies the example verbatim over the real path still gets
 * rejected until they flip the flag deliberately). Any missing file, parse
 * failure, or invalid/missing required field yields `null` — the caller
 * (runCallLedger.ts's rollup join) treats a `null` result as "PRICE NOT
 * VERIFIED" and must not print a dollar number anywhere.
 *
 * `loadPriceTable` is the simple present/absent API most callers want.
 * `loadPriceTableDetailed` is the same check with a typed rejection reason,
 * for tests and any diagnostic surface that wants to say WHY a table was
 * rejected rather than just that it was.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export const PRICE_TABLE_SCHEMA = "chapterflow-price-table-v1" as const;

/** A `priceVersion`/`effectiveDate` must contain an embedded `YYYY-MM-DD`
 *  date — the "dated string" requirement (WP-E42 spec) enforced structurally
 *  rather than by convention, so a table can't ship an undated, unorderable
 *  version tag. */
const EMBEDDED_DATE_RE = /\d{4}-\d{2}-\d{2}/;
const STRICT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type PriceTablePriceV1 = {
  /** Flat per-session price for one model id — the only unit this table
   *  prices in (matches the ledger's `trueSessionCalls` currency; no
   *  per-token arithmetic here). */
  perSession: number;
};

export type PriceTableV1 = {
  schema: typeof PRICE_TABLE_SCHEMA;
  /** Dated version tag (e.g. "2026-07-17"), never a bare "v1" — must embed a
   *  YYYY-MM-DD date so two tables are orderable by date. */
  priceVersion: string;
  /** Strict YYYY-MM-DD date this table's prices took effect. */
  effectiveDate: string;
  /** MUST be the literal `true` — the loader rejects any other value,
   *  including a truthy non-boolean, so a table can only be loaded after an
   *  explicit, deliberate flip (never by copy-pasting the example). */
  ownerApproved: true;
  /** modelId → price. Unknown model ids simply have no entry — the rollup
   *  join treats an unpriced model as contributing $0, never a guess. */
  prices: Record<string, PriceTablePriceV1>;
};

export type PriceTableRejectReason =
  | "file-absent"
  | "invalid-json"
  | "not-an-object"
  | "wrong-schema"
  | "missing-priceVersion"
  | "missing-effectiveDate"
  | "not-owner-approved"
  | "missing-prices"
  | "invalid-price-entry";

export type PriceTableLoadResult =
  | { status: "loaded"; table: PriceTableV1 }
  | { status: "rejected"; reason: PriceTableRejectReason };

export function priceTablePath(pipelineDir: string): string {
  return resolve(pipelineDir, "config", "price-table.v1.json");
}

/** Validate + narrow an already-parsed JSON value into a `PriceTableV1`, or
 *  report the specific typed reason it was rejected. Every required field is
 *  checked explicitly — a table missing ANY one of them is rejected in full,
 *  never partially accepted. */
function validatePriceTable(raw: unknown): PriceTableLoadResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { status: "rejected", reason: "not-an-object" };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.schema !== PRICE_TABLE_SCHEMA) {
    return { status: "rejected", reason: "wrong-schema" };
  }
  if (typeof obj.priceVersion !== "string" || !EMBEDDED_DATE_RE.test(obj.priceVersion)) {
    return { status: "rejected", reason: "missing-priceVersion" };
  }
  if (typeof obj.effectiveDate !== "string" || !STRICT_DATE_RE.test(obj.effectiveDate)) {
    return { status: "rejected", reason: "missing-effectiveDate" };
  }
  // Strict `=== true`: an owner-approved gate that accepted any truthy value
  // (a non-empty string, `1`) would defeat the whole point of the flag.
  if (obj.ownerApproved !== true) {
    return { status: "rejected", reason: "not-owner-approved" };
  }
  if (typeof obj.prices !== "object" || obj.prices === null || Array.isArray(obj.prices)) {
    return { status: "rejected", reason: "missing-prices" };
  }
  const rawPrices = obj.prices as Record<string, unknown>;
  const prices: Record<string, PriceTablePriceV1> = {};
  for (const [modelId, entry] of Object.entries(rawPrices)) {
    if (typeof entry !== "object" || entry === null) {
      return { status: "rejected", reason: "invalid-price-entry" };
    }
    const perSession = (entry as Record<string, unknown>).perSession;
    if (typeof perSession !== "number" || !Number.isFinite(perSession) || perSession < 0) {
      return { status: "rejected", reason: "invalid-price-entry" };
    }
    prices[modelId] = { perSession };
  }

  return {
    status: "loaded",
    table: {
      schema: PRICE_TABLE_SCHEMA,
      priceVersion: obj.priceVersion,
      effectiveDate: obj.effectiveDate,
      ownerApproved: true,
      prices,
    },
  };
}

/** Detailed load: same gate as `loadPriceTable`, plus the typed reason a
 *  rejected table failed for (never used to decide anything downstream of the
 *  rollup — that consumer only ever sees `null` vs a valid table). */
export function loadPriceTableDetailed(pipelineDir: string): PriceTableLoadResult {
  const path = priceTablePath(pipelineDir);
  if (!existsSync(path)) {
    return { status: "rejected", reason: "file-absent" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { status: "rejected", reason: "invalid-json" };
  }
  return validatePriceTable(raw);
}

/** `config/price-table.v1.json` IF present and valid → the table. Missing
 *  file, unparsable JSON, or any invalid/missing required field → `null`.
 *  Callers must treat `null` as "PRICE NOT VERIFIED", never as "$0". */
export function loadPriceTable(pipelineDir: string): PriceTableV1 | null {
  const result = loadPriceTableDetailed(pipelineDir);
  return result.status === "loaded" ? result.table : null;
}
