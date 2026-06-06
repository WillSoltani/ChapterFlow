import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getEventProgress } from "@/app/app/api/book/_lib/events-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { eventId } = await ctx.params;

    const progress = await getEventProgress(tableName, user.sub, eventId);
    if (!progress) {
      return bookErr(req, 404, "not_joined", "You haven't joined this event");
    }

    return bookOk({ progress });
  });
}
