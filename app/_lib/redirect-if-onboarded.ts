import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { shouldRethrowOnboardingGuardError } from "./onboarding-guard-core";

/**
 * Shared "already-onboarded" guard for the two onboarding-funnel entry points
 * (`/book`, `/onboarding`). A user who has already completed onboarding is sent
 * straight to /dashboard — no client-side flash of the flow.
 *
 * The settings lookup is an OPTIMIZATION only (it skips re-running a completed
 * flow); the completion route still enforces correctness. So on any non-auth
 * failure — a locally-unset BOOK_TABLE_NAME in dev/CI, or a transient
 * DynamoDB/network hiccup in prod — this fails OPEN and renders the flow rather
 * than crashing to the error boundary. Centralizing the catch policy here is
 * what keeps the two entry points from drifting (they previously diverged: one
 * degraded, the other error-paged on the same failure).
 */
export async function redirectIfOnboarded(): Promise<void> {
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserSettingsItem(tableName, user.sub);
    const onboarding = item?.settings?.onboarding as
      | { onboardingCompleted?: boolean }
      | undefined;

    if (onboarding?.onboardingCompleted === true) {
      redirect("/dashboard");
    }
  } catch (e) {
    if (shouldRethrowOnboardingGuardError(e)) throw e;
  }
}
