import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser, AuthError } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { OnboardingFlow } from "@/app/onboarding/components/OnboardingFlow";

export default async function BookOnboardingPage() {
  await requireDashboardAccess();

  // Server-side check: if the user has already completed onboarding,
  // redirect straight to the workspace. No client-side flash.
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserSettingsItem(tableName, user.sub);
    const onboarding = item?.settings?.onboarding as
      | Record<string, unknown>
      | undefined;

    if (onboarding?.onboardingCompleted === true) {
      redirect("/dashboard");
    }
  } catch (e) {
    // Re-throw Next.js redirects so they take effect
    if (e instanceof Error && "digest" in e) throw e;
    // Only swallow AuthError (dev bypass or token issues).
    // Re-throw everything else (DynamoDB, network, etc.) so the error
    // boundary catches it instead of silently showing onboarding.
    if (!(e instanceof AuthError)) throw e;
  }

  return <OnboardingFlow />;
}
