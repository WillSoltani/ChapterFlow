import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  requireInteger,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  listEventDefinitions,
  putEventDefinition,
} from "@/app/app/api/book/_lib/admin-events-repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import type { EventDefinitionItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const events = await listEventDefinitions(tableName);
    return bookOk({ events });
  });
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireAdminUser();
    const tableName = await getBookTableName();
    const body = requireBodyObject(await req.json());

    const eventId = requireString(body.eventId, "eventId", { minLength: 3, maxLength: 100 });
    const title = requireString(body.title, "title", { minLength: 1, maxLength: 200 });
    const description = requireString(body.description, "description", { minLength: 1, maxLength: 500 });
    const startDate = requireString(body.startDate, "startDate");
    const endDate = requireString(body.endDate, "endDate");
    const dailyChapterTarget = requireInteger(body.dailyChapterTarget, "dailyChapterTarget", { min: 1, max: 10 });
    const targetChapters = requireInteger(body.targetChapters, "targetChapters", { min: 1, max: 200 });
    const bonusIP = requireInteger(body.bonusIP, "bonusIP", { min: 0, max: 5000 });

    if (!Array.isArray(body.books) || body.books.length === 0) {
      throw new BookApiError(400, "invalid_books", "books must be a non-empty array of book IDs.");
    }
    const books = body.books as string[];

    const badge = body.badge as { badgeId: string; name: string; icon: string } | undefined;
    if (!badge || !badge.badgeId || !badge.name || !badge.icon) {
      throw new BookApiError(400, "invalid_badge", "badge must include badgeId, name, and icon.");
    }

    const now = nowIso();
    const item: EventDefinitionItem = {
      eventId,
      title,
      description,
      startDate,
      endDate,
      books,
      dailyChapterTarget,
      targetChapters,
      badge,
      bonusIP,
      active: body.active !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: user.sub,
    };

    await putEventDefinition(tableName, item);
    return bookOk({ event: item });
  });
}
