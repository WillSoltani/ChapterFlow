import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  bookOk,
  requireBodyObject,
  requireInteger,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  deleteSavedBook,
  listSavedBooks,
  putSavedBook,
} from "@/app/app/api/book/_lib/repo";
import { paginateArray, parseListPaginationParams } from "@/app/app/api/book/_lib/list-pagination-core";

export const runtime = "nodejs";

// WS4-004: opt-in `?limit=&cursor=` page size bounds. Unlike notebook.get,
// `saved`/`savedBookIds` NEVER shrink below the full set — see the GET
// handler comment.
const SAVED_DEFAULT_PAGE_SIZE = 50;
const SAVED_MAX_PAGE_SIZE = 200;

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const saved = await listSavedBooks(tableName, user.sub);
    // `savedBookIds` is the native (iOS) contract — SavedBooksResponse decodes
    // exactly that key, and without it the device's Home/Library fail closed.
    // `saved` stays for the web client; keep BOTH, and keep BOTH COMPLETE
    // (never paginated) — iOS treats `savedBookIds` as the full authoritative
    // saved-book set, not a page of it.
    const url = new URL(req.url);
    const hasPaginationParams = url.searchParams.has("limit") || url.searchParams.has("cursor");
    if (!hasPaginationParams) {
      // Opt-in only: without ?limit=/?cursor= the response is byte-for-byte
      // what it was before WS4-004 — no new keys, no behavior change.
      return bookOk({ saved, savedBookIds: saved.map((s) => s.bookId) });
    }

    const params = parseListPaginationParams(url, {
      defaultLimit: SAVED_DEFAULT_PAGE_SIZE,
      maxLimit: SAVED_MAX_PAGE_SIZE,
    });
    const page = paginateArray(saved, {
      limit: params.limit,
      cursor: params.cursor,
      cursorKey: (item) => ({ id: item.bookId, createdAt: item.savedAt }),
    });

    return bookOk({
      saved,
      savedBookIds: saved.map((s) => s.bookId),
      items: page.items,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });
}

// The native client's toggle verb: body `{bookId, saved}` where `saved` is the
// DESIRED end state (true → save, false → unsave), responding with the full
// list. The web app mutates via PUT (rich fields) + DELETE; iOS sends a single
// POST toggle and re-renders from `savedBookIds`.
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const bookId = requireString(body.bookId, "bookId", { maxLength: 120 });

    if (body.saved === false) {
      await deleteSavedBook(tableName, user.sub, bookId);
    } else {
      await putSavedBook(tableName, { userId: user.sub, bookId });
    }
    const saved = await listSavedBooks(tableName, user.sub);
    return bookOk({ saved, savedBookIds: saved.map((s) => s.bookId) });
  });
}

export async function PUT(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const bookId = requireString(body.bookId, "bookId", { maxLength: 120 });
    const source =
      typeof body.source === "string" && body.source.trim()
        ? requireString(body.source, "source", { maxLength: 120 })
        : undefined;
    const priority =
      body.priority === undefined
        ? undefined
        : requireInteger(body.priority, "priority", { min: 0, max: 1000 });
    const pinned = body.pinned === true;

    const saved = await putSavedBook(tableName, {
      userId: user.sub,
      bookId,
      source,
      priority,
      pinned,
    });

    return bookOk({ saved });
  });
}

export async function DELETE(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const url = new URL(req.url);
    const bookId = requireString(url.searchParams.get("bookId"), "bookId", { maxLength: 120 });
    await deleteSavedBook(tableName, user.sub, bookId);
    const saved = await listSavedBooks(tableName, user.sub);
    return bookOk({ saved, savedBookIds: saved.map((s) => s.bookId) });
  });
}
