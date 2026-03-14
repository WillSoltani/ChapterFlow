import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookOnboardingClient } from "@/app/book/BookOnboardingClient";

export default async function BookOnboardingPage() {
  await requireDashboardAccess();
  return <BookOnboardingClient />;
}

