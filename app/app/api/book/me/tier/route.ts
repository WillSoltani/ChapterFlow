import "server-only";

// Implements §3.2 — Tier progress endpoint for client display.

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  getOrCreateTier,
  computeTierProgress,
  TIER_DEFINITIONS,
} from "@/app/app/api/book/_lib/tier-repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const tier = await getOrCreateTier(tableName, user.sub);
    const progress = computeTierProgress(tier);

    return bookOk({
      ...progress,
      tiers: TIER_DEFINITIONS.map((def) => ({
        name: def.name,
        displayName: def.displayName,
        loopsRequired: def.loopsRequired,
        avgScoreRequired: def.avgScoreRequired,
        categoriesRequired: def.categoriesRequired,
        identityStatement: def.identityStatement,
        reached: tier.tiersAdvanced.includes(def.name) || def.name === "reader",
      })),
    });
  });
}
