import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { joinEvent, getEventProgress } from "@/app/app/api/book/_lib/events-repo";

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

    const participation = await joinEvent(tableName, user.sub, eventId);
    return bookOk({ participation, isNew: true });
  });
}
