import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { startJourney, listUserJourneys } from "@/app/app/api/book/_lib/journey-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ journeyId: string }> };

export async function POST(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { journeyId } = await ctx.params;

    // Check max 3 active journeys
    const existing = await listUserJourneys(tableName, user.sub);
    const activeCount = existing.filter((j) => !j.completedAt).length;
    if (activeCount >= 3) {
      return bookErr(req, 400, "max_journeys", "You can have at most 3 active journeys");
    }

    // Check if already started
    if (existing.some((j) => j.journeyId === journeyId)) {
      return bookErr(req, 409, "already_started", "You already started this journey");
    }

    const journey = await startJourney(tableName, user.sub, journeyId);
    return bookOk({ journey, started: true });
  });
}
