import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  listEventDefinitions,
  putEventDefinition,
} from "@/app/app/api/book/_lib/admin-events-repo";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import seedEvents from "@/content/events/events.json";
import type { EventDefinition, EventDefinitionItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

/** POST /app/api/book/admin/events/seed — one-time import from events.json */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireAdminUser();
    const tableName = await getBookTableName();

    const existing = await listEventDefinitions(tableName);
    const existingIds = new Set(existing.map((e) => e.eventId));

    const now = nowIso();
    let seeded = 0;

    for (const def of seedEvents as EventDefinition[]) {
      if (existingIds.has(def.eventId)) continue;

      const item: EventDefinitionItem = {
        ...def,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: user.sub,
      };
      await putEventDefinition(tableName, item);
      seeded++;
    }

    return bookOk({ seeded, skipped: seedEvents.length - seeded });
  });
}
