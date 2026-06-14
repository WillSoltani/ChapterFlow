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
    // Swallow AuthError (dev bypass / token issues) and the locally-unset data
    // plane: BOOK_TABLE_NAME is provisioned via SSM in deployed envs and is
    // absent in local dev, so reading it throws. In both cases fall through to
    // onboarding — matching how app/book/library/[bookId]/page.tsx degrades.
    // Real DynamoDB/network errors still re-throw so the error boundary catches
    // them in production.
    const isLocalUnsetDataPlane =
      e instanceof Error && e.message.includes("BOOK_TABLE_NAME");
    if (!(e instanceof AuthError) && !isLocalUnsetDataPlane) throw e;
  }

  return <OnboardingFlow />;
}
