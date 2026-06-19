import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser, AuthError } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserSettingsItem } from "@/app/app/api/book/_lib/repo";
import { OnboardingFlow } from "./components/OnboardingFlow";

export default async function OnboardingPage() {
  // This route renders the onboarding flow, so it must opt out of the helper's
  // un-onboarded redirect (which targets "/book") — otherwise an un-onboarded
  // user here would be bounced away from onboarding.
  await requireDashboardAccess({ allowUnonboarded: true });

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
    // Re-throw Next.js redirects so the already-completed → /dashboard bounce
    // takes effect.
    if (e instanceof Error && "digest" in e) throw e;
    // Re-throw auth failures so token/session problems still propagate to the
    // auth boundary.
    if (e instanceof AuthError) throw e;
    // The settings lookup is only an optimization (it skips re-running a
    // completed flow). A non-auth failure here — a transient DynamoDB or
    // network error at the most fragile first-run moment — should NOT crash the
    // route to the generic error boundary. Swallow it and render the flow; the
    // server route still enforces correctness on completion.
  }

  return <OnboardingFlow />;
}
