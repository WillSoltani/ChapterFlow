import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
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
    // If it's a redirect (from Next.js), re-throw so it takes effect
    if (e instanceof Error && "digest" in e) throw e;
    // Dev bypass or token issues — fall through to render onboarding
  }

  return <OnboardingFlow />;
}
