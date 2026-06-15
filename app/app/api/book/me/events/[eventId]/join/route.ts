import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { joinEvent, getEventProgress } from "@/app/app/api/book/_lib/events-repo";
import { getEventDefinition } from "@/app/app/api/book/_lib/admin-events-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ eventId: string }> };

export async function POST(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { eventId } = await ctx.params;

    const existing = await getEventProgress(tableName, user.sub, eventId);
    if (existing) {
      return bookOk({ participation: existing, isNew: false });
    }

    // Server is source of truth: only allow joining an event that actually
    // exists and is currently within its active window. Otherwise the join
    // would persist a junk EVENT_PARTICIPATION row for a nonexistent/expired
    // event that can never earn rewards.
    const definition = await getEventDefinition(tableName, eventId);
    const now = new Date();
    if (
      !definition ||
      definition.active === false ||
      new Date(definition.startDate) > now ||
      new Date(definition.endDate) < now
    ) {
      return bookErr(req, 404, "not_found", "Event not found or not active.");
    }

    const participation = await joinEvent(tableName, user.sub, eventId);
    return bookOk({ participation, isNew: true });
  });
}
