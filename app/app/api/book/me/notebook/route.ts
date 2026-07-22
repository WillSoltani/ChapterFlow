import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { queryChapterStatesForNotebook } from "@/app/app/api/book/_lib/book-state-repo";
import { queryCommitmentItemsForNotebook } from "@/app/app/api/book/_lib/commitment-repo";
import { loadNotebookReads } from "@/app/app/api/book/_lib/notebook-read-core";
import { buildChapterStateNotebookEntries } from "@/app/app/api/book/_lib/notebook-entries";
import {
  buildHighlightNotebookEntries,
  highlightItemToNotebookEntry,
  parseHighlightCreateInput,
  parseHighlightUpdateInput,
} from "@/app/app/api/book/_lib/notebook-highlights-core";
import {
  createHighlight,
  deleteHighlight,
  listHighlights,
  updateHighlight,
} from "@/app/app/api/book/_lib/notebook-highlight-repo";
import type { BookUserHighlightItem, NotebookEntry } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

/** Parse an optional integer `chapter` query param; null when absent/invalid. */
function parseChapterFilter(url: URL): number | null {
  const raw = url.searchParams.get("chapter");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return requireBodyObject(raw);
}

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const bookIdFilter = url.searchParams.get("bookId");
    const chapterFilter = parseChapterFilter(url);
    const searchFilter = url.searchParams.get("search")?.toLowerCase();

    // WS4-009: the three reads below are independent (no read depends on
    // another's result), so fan them out concurrently instead of paying each
    // one's full round-trip serially.
    const {
      chapterStates: chapterStatesItems,
      commitments: commitmentItems,
      highlights,
    } = await loadNotebookReads({
      chapterStates: () => queryChapterStatesForNotebook(tableName, user.sub),
      commitments: () => queryCommitmentItemsForNotebook(tableName, user.sub),
      highlights: () => listHighlights(tableName, user.sub),
    });

    const entries: NotebookEntry[] = [];

    for (const item of chapterStatesItems) {
      const state = item.state as Record<string, unknown> | undefined;
      if (!state) continue;

      const sk = item.SK as string;
      const bookId = (item.bookId as string) || sk.split("#")[1] || "";
      const chapterNumber = Number(item.chapterNumber ?? 0);
      const bookTitle = (item.bookTitle as string) || bookId;
      const chapterTitle = (item.chapterTitle as string) || `Chapter ${chapterNumber}`;

      if (bookIdFilter && bookId !== bookIdFilter) continue;

      // Notes + bookmarked takeaways. Bookmarks read the takeaway TEXT map
      // (bookmarkedTakeawayTexts), not the numeric-index array, which the route
      // previously mis-read as strings and silently dropped. See
      // notebook-entries.ts for the projection + back-compat notes.
      entries.push(
        ...buildChapterStateNotebookEntries(state, {
          bookId,
          bookTitle,
          chapterNumber,
          chapterTitle,
          createdAt: (item.updatedAt as string) || (item.createdAt as string) || "",
        }),
      );
    }

    // Commitments → follow-through reflections (read above, fanned out with
    // the chapter-state and highlight reads).
    for (const item of commitmentItems) {
      const reflection = item.followThroughReflection as string | null;
      if (!reflection) continue;

      const bookId = item.bookId as string;
      if (bookIdFilter && bookId !== bookIdFilter) continue;

      entries.push({
        id: `commitment:${item.commitmentId}`,
        type: "commitment",
        bookId,
        bookTitle: bookId,
        chapterNumber: item.chapterNumber as number,
        chapterTitle: `Chapter ${item.chapterNumber}`,
        content: `${item.ifThenPlan}\n\nFollow-through: ${reflection}`,
        tags: [],
        createdAt: (item.followThroughSubmittedAt as string) || "",
      });
    }

    // Reader highlights (Feature B6) — first-class user-created entries, filtered
    // by book/chapter exactly like the derived types above (read above, fanned
    // out with the chapter-state and commitment reads).
    entries.push(
      ...buildHighlightNotebookEntries(highlights, {
        bookId: bookIdFilter,
        chapter: chapterFilter,
      }),
    );

    // Apply the chapter filter uniformly to the derived (note/bookmark/
    // commitment) entries too. No-op when the param is absent, so existing
    // callers see unchanged results.
    let filtered = entries;
    if (chapterFilter != null) {
      filtered = filtered.filter((e) => e.chapterNumber === chapterFilter);
    }

    // Apply search filter
    if (searchFilter) {
      filtered = filtered.filter(
        (e) =>
          e.content.toLowerCase().includes(searchFilter) ||
          e.bookTitle.toLowerCase().includes(searchFilter) ||
          e.chapterTitle.toLowerCase().includes(searchFilter),
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return bookOk({ entries: filtered, totalCount: filtered.length });
  });
}

// ── Reader highlight mutations (Feature B6) ───────────────────────────────────
//
// POST creates a highlight; PATCH updates one (colour/snippet/anchor); DELETE
// removes one. All three flow through `withBookApiErrors`, which auto-runs the
// same-origin/CSRF guard for cookie-authed browser calls and skips it for the
// native iOS client's Bearer-authenticated requests.

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const body = await safeJson(req);
    const input = parseHighlightCreateInput(body);

    const item: BookUserHighlightItem = {
      userId: user.sub,
      highlightId: crypto.randomUUID(),
      bookId: input.bookId,
      bookTitle: input.bookTitle || input.bookId,
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle || `Chapter ${input.chapterNumber}`,
      color: input.color,
      snippet: input.snippet,
      anchor: input.anchor,
      // Overwritten with server time by createHighlight.
      createdAt: "",
      updatedAt: "",
    };

    const created = await createHighlight(tableName, item);
    return bookOk({ entry: highlightItemToNotebookEntry(created) }, 201);
  });
}

export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const body = await safeJson(req);
    const highlightId = requireString(body.highlightId, "highlightId", { maxLength: 200 });
    const patch = parseHighlightUpdateInput(body);

    const updated = await updateHighlight(tableName, user.sub, highlightId, patch);
    if (!updated) {
      // updateHighlight throws 404 on a missing row; a null return would only
      // mean the driver echoed no attributes for an existing row — surface as 404.
      throw new BookApiError(404, "not_found", "Highlight not found.");
    }
    return bookOk({ entry: highlightItemToNotebookEntry(updated) });
  });
}

export async function DELETE(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const highlightId = requireString(
      url.searchParams.get("id") ?? url.searchParams.get("highlightId"),
      "id",
      { maxLength: 200 },
    );

    await deleteHighlight(tableName, user.sub, highlightId);
    return bookOk({ ok: true });
  });
}
