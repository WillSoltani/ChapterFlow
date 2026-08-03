import { BookApiError } from "./errors";
import type {
  BookUserHighlightItem,
  HighlightAnchor,
  HighlightColor,
  NotebookEntry,
} from "./types";

/**
 * Pure validation + projection for reader highlights (Feature B6).
 *
 * The iOS reader lets a user highlight a span of chapter text; each highlight is
 * persisted as a first-class notebook entry. This module owns everything that
 * can be unit-tested WITHOUT `server-only`/AWS at import time:
 *  - request-body validation (colour enum, snippet cap, anchor SHAPE), and
 *  - the persisted-item → `NotebookEntry` projection + book/chapter filtering.
 *
 * The `anchor` is treated as an OPAQUE object: the server validates its shape
 * (the six fields with the right primitive types) but never interprets the
 * numbers — it is stored verbatim and echoed back so the client can re-locate
 * the selection. Only `BookApiError` (a pure module) is imported here, so the
 * whole file stays test-safe.
 */

/** Closed set of highlight colours a client may tag a selection with. */
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  "yellow",
  "green",
  "blue",
  "pink",
  "orange",
];

/** Selected text is capped to this many characters (the snippet is truncated, not rejected). */
export const HIGHLIGHT_SNIPPET_MAX_CHARS = 500;

/** Upper bound on each anchor string field so a client can't store an unbounded blob. */
export const HIGHLIGHT_ANCHOR_STRING_MAX_CHARS = 200;

/** Sane ceiling for the anchor's integer offsets (defensive; never interpreted). */
const HIGHLIGHT_ANCHOR_INT_MAX = 10_000_000;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}

export function validateHighlightColor(value: unknown): HighlightColor {
  if (!isHighlightColor(value)) {
    throw new BookApiError(
      400,
      "invalid_input",
      `color must be one of: ${HIGHLIGHT_COLORS.join(", ")}.`,
    );
  }
  return value;
}

/**
 * Validate + normalise the selected-text snippet: required non-empty string,
 * trimmed, then truncated to {@link HIGHLIGHT_SNIPPET_MAX_CHARS} (the "capped"
 * contract — an over-long selection is clipped, not rejected).
 */
export function validateHighlightSnippet(value: unknown): string {
  if (typeof value !== "string") {
    throw new BookApiError(400, "invalid_input", "snippet must be a string.");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BookApiError(400, "invalid_input", "snippet is required.");
  }
  return trimmed.slice(0, HIGHLIGHT_SNIPPET_MAX_CHARS);
}

function requireAnchorString(
  obj: Record<string, unknown>,
  field: keyof HighlightAnchor,
): string {
  const v = obj[field];
  if (typeof v !== "string" || !v.trim()) {
    throw new BookApiError(400, "invalid_anchor", `anchor.${field} must be a non-empty string.`);
  }
  if (v.length > HIGHLIGHT_ANCHOR_STRING_MAX_CHARS) {
    throw new BookApiError(400, "invalid_anchor", `anchor.${field} is too long.`);
  }
  return v;
}

function requireAnchorOffset(
  obj: Record<string, unknown>,
  field: keyof HighlightAnchor,
): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > HIGHLIGHT_ANCHOR_INT_MAX) {
    throw new BookApiError(
      400,
      "invalid_anchor",
      `anchor.${field} must be a non-negative integer.`,
    );
  }
  return v;
}

/**
 * Validate the highlight anchor's SHAPE and return a normalised copy holding
 * ONLY the six known fields (any extra keys the client sent are dropped, so the
 * stored blob stays bounded). Numbers are checked for type/range but never
 * interpreted, except that `endChar` may not precede `startChar` — a negative
 * span is a malformed shape, not a meaningful selection.
 */
export function validateHighlightAnchor(value: unknown): HighlightAnchor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BookApiError(400, "invalid_anchor", "anchor must be an object.");
  }
  const o = value as Record<string, unknown>;
  const anchor: HighlightAnchor = {
    variant: requireAnchorString(o, "variant"),
    tone: requireAnchorString(o, "tone"),
    blockType: requireAnchorString(o, "blockType"),
    blockIndex: requireAnchorOffset(o, "blockIndex"),
    startChar: requireAnchorOffset(o, "startChar"),
    endChar: requireAnchorOffset(o, "endChar"),
  };
  if (anchor.endChar < anchor.startChar) {
    throw new BookApiError(400, "invalid_anchor", "anchor.endChar must be >= anchor.startChar.");
  }
  return anchor;
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new BookApiError(400, "invalid_input", `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BookApiError(400, "invalid_input", `${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new BookApiError(400, "invalid_input", `${field} is too long.`);
  }
  return trimmed;
}

function optionalBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireBoundedString(value, field, maxLength);
}

function requireChapterNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100000) {
    throw new BookApiError(400, "invalid_input", "chapterNumber must be a non-negative integer.");
  }
  return value;
}

export type ParsedHighlightCreate = {
  bookId: string;
  chapterNumber: number;
  color: HighlightColor;
  snippet: string;
  anchor: HighlightAnchor;
  bookTitle?: string | undefined;
  chapterTitle?: string | undefined;
};

/**
 * Validate a POST body into a create payload. A `type` field, if present, must
 * be `"highlight"` (POST /me/notebook only creates highlights); notes/bookmarks/
 * commitments are produced by other flows and are not createable here.
 */
export function parseHighlightCreateInput(body: Record<string, unknown>): ParsedHighlightCreate {
  if (body.type !== undefined && body.type !== "highlight") {
    throw new BookApiError(
      400,
      "unsupported_type",
      "Only highlight entries can be created via this endpoint.",
    );
  }
  return {
    bookId: requireBoundedString(body.bookId, "bookId", 120),
    chapterNumber: requireChapterNumber(body.chapterNumber),
    color: validateHighlightColor(body.color),
    snippet: validateHighlightSnippet(body.snippet),
    anchor: validateHighlightAnchor(body.anchor),
    bookTitle: optionalBoundedString(body.bookTitle, "bookTitle", 300),
    chapterTitle: optionalBoundedString(body.chapterTitle, "chapterTitle", 300),
  };
}

export type ParsedHighlightUpdate = {
  color?: HighlightColor;
  snippet?: string;
  anchor?: HighlightAnchor;
};

/**
 * Validate a PATCH body into a partial update. At least one of colour / snippet
 * / anchor must be present; each present field is validated the same way as on
 * create. Book / chapter / anchor identity is otherwise immutable.
 */
export function parseHighlightUpdateInput(body: Record<string, unknown>): ParsedHighlightUpdate {
  const patch: ParsedHighlightUpdate = {};
  if (body.color !== undefined) patch.color = validateHighlightColor(body.color);
  if (body.snippet !== undefined) patch.snippet = validateHighlightSnippet(body.snippet);
  if (body.anchor !== undefined) patch.anchor = validateHighlightAnchor(body.anchor);
  if (patch.color === undefined && patch.snippet === undefined && patch.anchor === undefined) {
    throw new BookApiError(
      400,
      "invalid_input",
      "Provide at least one of color, snippet, or anchor to update.",
    );
  }
  return patch;
}

/** Project a persisted highlight row into the shared `NotebookEntry` shape. */
export function highlightItemToNotebookEntry(item: BookUserHighlightItem): NotebookEntry {
  return {
    id: `highlight:${item.highlightId}`,
    type: "highlight",
    bookId: item.bookId,
    bookTitle: item.bookTitle || item.bookId,
    chapterNumber: item.chapterNumber,
    chapterTitle: item.chapterTitle || `Chapter ${item.chapterNumber}`,
    // `content` mirrors the snippet so the existing (type-agnostic) notebook UI
    // and the GET `search` filter keep working unchanged for highlights too.
    content: item.snippet,
    tags: [],
    createdAt: item.createdAt,
    color: item.color,
    snippet: item.snippet,
    anchor: item.anchor,
  };
}

/**
 * Project + filter a list of persisted highlights into notebook entries. Filters
 * by `bookId` and/or `chapter` exactly like the other notebook entry types; an
 * absent filter matches everything (so existing GET behaviour is unchanged).
 */
export function buildHighlightNotebookEntries(
  items: BookUserHighlightItem[],
  filters: { bookId?: string | null; chapter?: number | null } = {},
): NotebookEntry[] {
  const { bookId, chapter } = filters;
  const entries: NotebookEntry[] = [];
  for (const item of items) {
    if (bookId && item.bookId !== bookId) continue;
    if (chapter != null && item.chapterNumber !== chapter) continue;
    entries.push(highlightItemToNotebookEntry(item));
  }
  return entries;
}
