import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getJourneyProgress,
  listUserJourneys,
  reconcileJourneyCompletedBooks,
  startJourney,
} from "@/app/app/api/book/_lib/journey-repo";
import { logger } from "@/lib/logging/logger";
import journeyDefinitions from "@/content/journeys/journeys.json";
import type { JourneyDefinition } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ journeyId: string }> };

export async function POST(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { journeyId } = await ctx.params;

    const def = (journeyDefinitions as JourneyDefinition[]).find(
      (d) => d.journeyId === journeyId,
    );
    if (!def) {
      return bookErr(req, 404, "not_found", "Journey not found");
    }

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

    let journey = await startJourney(tableName, user.sub, journeyId);

    // Credit journey books the reader already finished (best-effort: a failure
    // here never fails the start; the next passed quiz reconciles again).
    try {
      const contentBucket = await getBookContentBucket();
      const result = await reconcileJourneyCompletedBooks(
        tableName,
        contentBucket,
        user.sub,
        journey,
      );
      if (result?.advanced) {
        journey = (await getJourneyProgress(tableName, user.sub, journeyId)) ?? journey;
      }
    } catch (error) {
      logger.warn("journey_start_reconcile_failed", { journeyId, err: error });
    }

    return bookOk({ journey, started: true });
  });
}
