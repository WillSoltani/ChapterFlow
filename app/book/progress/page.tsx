import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookProgressClient } from "@/app/book/progress/BookProgressClient";

export default async function BookProgressPage() {
  await requireDashboardAccess();
  return <BookProgressClient />;
}
