import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserProfileItem } from "@/app/app/api/book/_lib/repo";
import { BookOnboardingClient } from "@/app/book/BookOnboardingClient";

type BookOnboardingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function hasEnabledFlag(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.some((entry) => entry === "1" || entry === "true");
  }
  return value === "1" || value === "true";
}

export default async function BookOnboardingPage({
  searchParams,
}: BookOnboardingPageProps) {
  await requireDashboardAccess();
  const resolvedSearchParams = (await searchParams) ?? {};
  const previewMode =
    hasEnabledFlag(resolvedSearchParams.preview) ||
    hasEnabledFlag(resolvedSearchParams.inspect);

  // Server-side check: if the user has already completed onboarding, skip
  // straight to the app — no client-side flash or localStorage round-trip.
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const item = await getUserProfileItem(tableName, user.sub);
    if (!previewMode && item?.profile?.onboardingCompleted === true) {
      redirect("/book/workspace");
    }
  } catch {
    // Dev bypass or token missing — fall through to render the client.
  }

  return <BookOnboardingClient />;
}
