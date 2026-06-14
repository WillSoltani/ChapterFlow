import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser, AuthError } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { OnboardingFlow } from "./components/OnboardingFlow";

export default async function OnboardingPage() {
  await requireDashboardAccess();

  // Server-side guard: a user who has already completed onboarding should never
  // see the flow again — send them straight to the dashboard, no client flash.
  // Mirrors app/book/page.tsx so both onboarding entry points behave the same.
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
    // Re-throw Next.js redirects so they take effect.
    if (e instanceof Error && "digest" in e) throw e;
    // Only swallow AuthError (dev bypass / token issues); surface everything
    // else (DynamoDB, network) to the error boundary rather than silently
    // showing onboarding.
    if (!(e instanceof AuthError)) throw e;
  }

  return <OnboardingFlow />;
}
