/**
 * Pure pagination core for LIST APIs that page over an already-fetched,
 * already-sorted in-memory array (notebook entries, saved books, review
 * cards, …) via `?limit=&cursor=` — as opposed to `query-pagination-core.ts`,
 * which follows DynamoDB's own `LastEvaluatedKey` to read a FULL partition
 * server-side across 1MB Query pages.
 *
 * No `server-only` import (directly or transitively), so this stays unit
 * testable; see `query-pagination-core.ts`'s header comment for why that
 * constraint exists on sibling `*-repo.ts` modules.
 */

import { BookApiError } from "./errors";

export interface ListPaginationParams {
  limit: number;
  cursor: string | null;
}

export interface ParseListPaginationParamsOptions {
  /** `limit` used when the caller sends no `?limit=` at all. */
  defaultLimit: number;
  /** Hard ceiling a caller-supplied `?limit=` is clamped down to. */
  maxLimit: number;
}

/**
 * Parse the `?limit=&cursor=` query params shared by every paginated list
 * endpoint. `limit` defaults to `defaultLimit` when the param is absent and
 * is clamped down to `maxLimit` when it's larger; a PRESENT but invalid
 * `limit` (non-numeric, non-integer, zero, or negative) throws
 * `BookApiError(400, "invalid_input")` instead of silently substituting the
 * default — a caller that sent a bad value should see why its page came back
 * wrong, not get a mysteriously-different page size. `cursor` is returned
 * as-is (decoded lazily, by `paginateArray` or the caller) so this same
 * parser also serves callers pairing it with a non-array cursor (e.g. a raw
 * DynamoDB `LastEvaluatedKey` — see `listNotificationsPage`).
 */
export function parseListPaginationParams(
  url: URL,
  opts: ParseListPaginationParamsOptions
): ListPaginationParams {
  const rawLimit = url.searchParams.get("limit");
  let limit = opts.defaultLimit;
  if (rawLimit !== null && rawLimit.trim() !== "") {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BookApiError(400, "invalid_input", "limit must be a positive integer.");
    }
    limit = Math.min(parsed, opts.maxLimit);
  }

  const rawCursor = url.searchParams.get("cursor");
  const cursor = rawCursor && rawCursor.trim() !== "" ? rawCursor : null;

  return { limit, cursor };
}

/**
 * Base64url-JSON envelope shared by every cursor this module issues: array
 * offset cursors from `paginateArray` below, and a caller's own opaque
 * payload (e.g. `listNotificationsPage` wraps a raw DynamoDB
 * `LastEvaluatedKey` in it). A cursor the caller didn't get from us —
 * hand-edited, truncated, or plain garbage — throws `BookApiError(400,
 * "invalid_cursor")` rather than silently reinterpreting it as page one or
 * crashing the request on an unhandled parse error.
 */
export function encodeListCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeListCursor<T = unknown>(raw: string): T {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    throw new BookApiError(400, "invalid_cursor", "The pagination cursor is malformed.");
  }
}

interface ArrayCursorPayload {
  offset: number;
  id: string;
  createdAt: string;
}

function isArrayCursorPayload(value: unknown): value is ArrayCursorPayload {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.offset === "number" &&
    Number.isInteger(rec.offset) &&
    rec.offset >= 0 &&
    typeof rec.id === "string" &&
    typeof rec.createdAt === "string"
  );
}

export interface PaginateArrayOptions<T> {
  limit: number;
  cursor?: string | null;
  /**
   * Extracts the (id, sort-key) tie-break pair `paginateArray` uses to find
   * the cursor's position by CONTENT rather than raw array index, so a
   * cursor minted from one fetch of `sortedItems` still resolves correctly
   * against a later, independently-fetched-but-identically-sorted array (the
   * common case: nothing changed between the two requests). Defaults to
   * reading `.id`/`.createdAt` straight off the item, which fits e.g.
   * notebook entries as-is; callers whose items use different field names
   * (`bookId`/`savedAt`, `cardId`/`dueAt`, …) supply their own.
   */
  cursorKey?: (item: T) => { id: string; createdAt: string };
}

export interface PaginateArrayResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

function defaultCursorKey<T>(item: T): { id: string; createdAt: string } {
  const rec = item as unknown as Record<string, unknown> | null | undefined;
  const id = rec && typeof rec === "object" ? rec.id : undefined;
  const createdAt = rec && typeof rec === "object" ? rec.createdAt : undefined;
  return {
    id: typeof id === "string" ? id : "",
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };
}

/**
 * Slice one page out of an already-sorted in-memory array. `cursor` (when
 * present) must be a value THIS function itself issued via a prior
 * `nextCursor` — a garbage/foreign cursor throws `BookApiError(400,
 * "invalid_cursor")` (via `decodeListCursor`).
 *
 * The cursor carries both a raw offset and the last-returned item's
 * (id, sort-key) tie-break. Resuming from it prefers locating that exact
 * item by content — stable even if unrelated rows were added or removed
 * earlier in the array between the two requests — and only falls back to the
 * raw offset when the referenced item can no longer be found (e.g. it was
 * deleted), mirroring the tie-break most cursor-paginated APIs use instead
 * of a bare numeric offset.
 */
export function paginateArray<T>(
  sortedItems: T[],
  opts: PaginateArrayOptions<T>
): PaginateArrayResult<T> {
  const cursorKey = opts.cursorKey ?? defaultCursorKey;

  let startIndex = 0;
  if (opts.cursor) {
    const decoded = decodeListCursor(opts.cursor);
    if (!isArrayCursorPayload(decoded)) {
      throw new BookApiError(400, "invalid_cursor", "The pagination cursor is malformed.");
    }
    const idx = sortedItems.findIndex((item) => {
      const key = cursorKey(item);
      return key.id === decoded.id && key.createdAt === decoded.createdAt;
    });
    startIndex = idx >= 0 ? idx + 1 : decoded.offset;
  }

  const clampedStart = Math.min(Math.max(startIndex, 0), sortedItems.length);
  const page = sortedItems.slice(clampedStart, clampedStart + opts.limit);
  const nextIndex = clampedStart + page.length;
  const hasMore = nextIndex < sortedItems.length;

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = cursorKey(page[page.length - 1]!); // hasMore ⇒ page is non-empty
    const payload: ArrayCursorPayload = { offset: nextIndex, id: last.id, createdAt: last.createdAt };
    nextCursor = encodeListCursor(payload);
  }

  return { items: page, nextCursor, hasMore };
}
