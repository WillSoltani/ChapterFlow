import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import {
  bookOk,
  requireBodyObject,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserSettingsItem,
  putUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * PATCH /api/book/me/onboarding/progress
 *
 * Saves incremental onboarding step progress server-side.
 * This is a lightweight fire-and-forget call made after each step
 * so progress survives browser clears. The data is merged into
 * settings.onboarding_progress (separate from the final
 * settings.onboarding which is written on completion).
 */
export async function PATCH(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const body = requireBodyObject(await req.json());

    const existing = await getUserSettingsItem(tableName, user.sub);
    const currentSettings = existing?.settings ?? {};
    const currentProgress =
      (currentSettings.onboarding_progress as Record<string, unknown>) ?? {};

    const mergedProgress: Record<string, unknown> = {
      ...currentProgress,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    const mergedSettings: Record<string, unknown> = {
      ...currentSettings,
      onboarding_progress: mergedProgress,
    };

    await putUserSettingsItem(tableName, {
      userId: user.sub,
      settings: mergedSettings,
      createdAt: existing?.createdAt,
    });

    return bookOk({ success: true });
  });
}

/**
 * GET /api/book/me/onboarding/progress
 *
 * Retrieves any saved onboarding progress for resuming.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const existing = await getUserSettingsItem(tableName, user.sub);
    const settings = existing?.settings ?? {};
    const onboarding = settings.onboarding as Record<string, unknown> | undefined;
    const progress = settings.onboarding_progress as Record<string, unknown> | undefined;

    return bookOk({
      onboardingCompleted: !!onboarding?.onboardingCompleted,
      progress: progress ?? null,
      preferences: onboarding ?? null,
    });
  });
}
