import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookHomeClient } from "@/app/book/home/BookHomeClient";

export default async function BookWorkspacePage() {
  await requireDashboardAccess();
  return <BookHomeClient />;
}
