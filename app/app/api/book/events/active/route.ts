import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { listUserEvents } from "@/app/app/api/book/_lib/events-repo";
import { listEventDefinitions } from "@/app/app/api/book/_lib/admin-events-repo";
import type { EventDefinition, EventParticipationItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

export type ActiveEventWithParticipation = EventDefinition & {
  participation?: EventParticipationItem;
};

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const allDefs = await listEventDefinitions(tableName);

    const now = new Date();
    const active = allDefs.filter(
      (e) =>
        e.active !== false &&
        new Date(e.startDate) <= now &&
        new Date(e.endDate) >= now,
    );

    const userParticipations = await listUserEvents(tableName, user.sub);
    const participationMap = new Map(
      userParticipations.map((p) => [p.eventId, p]),
    );

    const events: ActiveEventWithParticipation[] = active.map((event) => ({
      ...event,
      participation: participationMap.get(event.eventId) ?? undefined,
    }));

    return bookOk({ events });
  });
}
