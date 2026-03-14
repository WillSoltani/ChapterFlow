import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookBadgesClient } from "@/app/book/badges/BookBadgesClient";

export default async function BookBadgesPage() {
  await requireDashboardAccess();
  return <BookBadgesClient />;
}
