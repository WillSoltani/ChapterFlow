import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  bookErr,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getEventDefinition,
  putEventDefinition,
  deleteEventDefinition,
} from "@/app/app/api/book/_lib/admin-events-repo";
import type { EventDefinitionItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { eventId } = await ctx.params;

    const event = await getEventDefinition(tableName, eventId);
    if (!event) {
      return bookErr(req, 404, "not_found", "Event not found");
    }

    return bookOk({ event });
  });
}

export async function PATCH(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { eventId } = await ctx.params;
    const body = requireBodyObject(await req.json());

    const existing = await getEventDefinition(tableName, eventId);
    if (!existing) {
      return bookErr(req, 404, "not_found", "Event not found");
    }

    // L39 — validate `books` on update with the same rules the POST creator
    // enforces (non-empty array of ≤200 non-empty string IDs) so a PATCH can't
    // slip a malformed/oversized book list past the creator's guard.
    let books = existing.books;
    if (body.books !== undefined) {
      if (!Array.isArray(body.books) || body.books.length === 0) {
        throw new BookApiError(400, "invalid_books", "books must be a non-empty array of book IDs.");
      }
      if (body.books.length > 200) {
        throw new BookApiError(400, "invalid_books", "books must contain at most 200 book IDs.");
      }
      if (!body.books.every((b) => typeof b === "string" && b.trim().length > 0)) {
        throw new BookApiError(400, "invalid_books", "books must contain only non-empty string book IDs.");
      }
      books = body.books.map((b) => (b as string).trim());
    }

    const updated: EventDefinitionItem = {
      ...existing,
      title: typeof body.title === "string" ? body.title : existing.title,
      description: typeof body.description === "string" ? body.description : existing.description,
      startDate: typeof body.startDate === "string" ? body.startDate : existing.startDate,
      endDate: typeof body.endDate === "string" ? body.endDate : existing.endDate,
      books,
      dailyChapterTarget: typeof body.dailyChapterTarget === "number" ? body.dailyChapterTarget : existing.dailyChapterTarget,
      targetChapters: typeof body.targetChapters === "number" ? body.targetChapters : existing.targetChapters,
      bonusIP: typeof body.bonusIP === "number" ? body.bonusIP : existing.bonusIP,
      badge: body.badge && typeof body.badge === "object" ? (body.badge as EventDefinitionItem["badge"]) : existing.badge,
      active: typeof body.active === "boolean" ? body.active : existing.active,
    };

    await putEventDefinition(tableName, updated);
    return bookOk({ event: updated });
  });
}

export async function DELETE(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const { eventId } = await ctx.params;

    await deleteEventDefinition(tableName, eventId);
    return bookOk({ deleted: true });
  });
}
