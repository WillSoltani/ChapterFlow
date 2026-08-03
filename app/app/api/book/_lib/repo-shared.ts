// This module was split out of repo.ts (WS3-004). Code moved verbatim.

import {
  QueryCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { paginateQuery } from "./query-pagination-core";

export function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value instanceof Set) {
    return Array.from(value).filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException"
  );
}

/**
 * Run a DynamoDB Query and follow `LastEvaluatedKey` until the full result set
 * has been read, accumulating every page's `Items`. A single `QueryCommand`
 * returns at most 1MB, so any unbounded full-partition list must paginate or it
 * silently truncates as the partition grows. Mirrors the loop already used in
 * admin-metrics.ts / economy-health.ts / soft-decay.ts.
 *
 * The page-following loop itself lives in `query-pagination-core.ts` (a pure,
 * `server-only`-free seam so it can be unit-tested); this wrapper just supplies
 * `ddbDoc.send`.
 *
 * Pass the same input you would give `QueryCommand` (without
 * `ExclusiveStartKey`); a `Limit`, if supplied, is treated as a per-page hint.
 */
export async function queryAllItems(
  input: Omit<QueryCommandInput, "ExclusiveStartKey">
): Promise<Record<string, unknown>[]> {
  return paginateQuery(async (exclusiveStartKey) => {
    const res = await ddbDoc.send(
      new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey })
    );
    return {
      items: res.Items ?? [],
      lastEvaluatedKey: res.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  });
}
