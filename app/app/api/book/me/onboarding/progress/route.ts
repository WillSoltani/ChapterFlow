import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  assertWithinTotalSize,
  bookOk,
  readJsonBody,
  SETTINGS_TOTAL_MAX_CHARS,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  getUserSettingsItem,
  updateUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/** Most keys one progress PATCH may carry (iOS sends three). */
const MAX_PROGRESS_KEYS = 32;

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
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const body = await readJsonBody(req);
    // updatedAt is reserved: the server stamps it below.
    delete body.updatedAt;
    if (Object.keys(body).length > MAX_PROGRESS_KEYS) {
      throw new BookApiError(413, "payload_too_large", "That onboarding update has too many fields.");
    }

    // Optimistic-concurrency read-modify-write, like the settings PATCH, so a
    // settings change saved at the same time (theme, an email unsubscribe) is
    // never overwritten. Unknown progress keys are still accepted.
    await updateUserSettingsItem(tableName, user.sub, (currentSettings) => {
      const currentProgress =
        (currentSettings.onboarding_progress as Record<string, unknown>) ?? {};
      const merged: Record<string, unknown> = {
        ...currentSettings,
        onboarding_progress: {
          ...currentProgress,
          ...body,
          updatedAt: new Date().toISOString(),
        },
      };
      // Growth-only cap, as in the settings PATCH.
      assertWithinTotalSize(
        merged,
        SETTINGS_TOTAL_MAX_CHARS,
        "settings",
        JSON.stringify(currentSettings).length,
      );
      return merged;
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
    const user = await requireActiveBookUser();
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
