import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
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

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const saved = await listSavedBooks(tableName, user.sub);
    return bookOk({ saved });
  });
}

export async function PUT(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
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
    const user = await requireUser();
    const tableName = await getBookTableName();
    const url = new URL(req.url);
    const bookId = requireString(url.searchParams.get("bookId"), "bookId", { maxLength: 120 });
    await deleteSavedBook(tableName, user.sub, bookId);
    return bookOk({ ok: true });
  });
}
