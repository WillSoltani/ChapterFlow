import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserProfileItem } from "@/app/app/api/book/_lib/repo";
import { BookOnboardingClient } from "@/app/book/BookOnboardingClient";

const LOCK_ON_ONBOARDING_FOR_INSPECTION = true;

export default async function BookOnboardingPage() {
  await requireDashboardAccess();

  // Server-side check: if the user has already completed onboarding, skip
  // straight to the app — no client-side flash or localStorage round-trip.
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserProfileItem(tableName, user.sub);
    if (
      !LOCK_ON_ONBOARDING_FOR_INSPECTION &&
      item?.profile?.onboardingCompleted === true
    ) {
      // Temporarily disabled while onboarding is being inspected.
    }
  } catch {
    // Dev bypass or token missing — fall through to render the client.
  }

  return <BookOnboardingClient />;
}
