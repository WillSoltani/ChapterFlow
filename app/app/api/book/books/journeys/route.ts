import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { listUserJourneys } from "@/app/app/api/book/_lib/journey-repo";
import journeyDefinitions from "@/content/journeys/journeys.json";
import type { JourneyDefinition, BookUserJourneyItem } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const userJourneys = await listUserJourneys(tableName, user.sub);
    const progressMap = new Map(userJourneys.map((j) => [j.journeyId, j]));

    const journeys = (journeyDefinitions as JourneyDefinition[]).map((def) => ({
      ...def,
      progress: progressMap.get(def.journeyId) ?? undefined,
    }));

    return bookOk({ journeys });
  });
}
