import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { ReviewPageClient } from "./ReviewPageClient";

export const metadata = { title: "Review" };

export default async function BookReviewPage() {
  await requireDashboardAccess();
  return <ReviewPageClient />;
}
