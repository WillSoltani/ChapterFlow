import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName, getBookAnalyticsTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserProfileItem,
  putUserProfileItem,
} from "@/app/app/api/book/_lib/repo";
import { analyticsTrackOnboarding } from "@/app/app/api/book/_lib/analytics-repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserProfileItem(tableName, user.sub);
    return bookOk({
      profile: item?.profile ?? null,
      updatedAt: item?.updatedAt ?? null,
    });
  });
}

export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const existing = await getUserProfileItem(tableName, user.sub);

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }

    const body = requireBodyObject(bodyRaw);
    const profile =
      body.profile && typeof body.profile === "object" && !Array.isArray(body.profile)
        ? (body.profile as Record<string, unknown>)
        : body;

    const saved = await putUserProfileItem(tableName, {
      userId: user.sub,
      profile,
      createdAt: existing?.createdAt,
    });

    // Analytics — fire-and-forget when onboarding is being completed
    if (profile.onboardingCompleted === true) {
      getBookAnalyticsTableName().then((analyticsTable) => {
        if (!analyticsTable) return;
        analyticsTrackOnboarding(analyticsTable, {
          userId: user.sub,
          email: user.email,
          goal: typeof profile.goal === "string" ? profile.goal : undefined,
          dailyGoalMinutes:
            typeof profile.dailyGoalMinutes === "number" ? profile.dailyGoalMinutes : undefined,
        }).catch(() => {});
      }).catch(() => {});
    }

    return bookOk({
      profile: saved.profile,
      updatedAt: saved.updatedAt,
    });
  });
}
