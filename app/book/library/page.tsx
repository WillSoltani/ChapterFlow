import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { BookLibraryClient } from "@/app/book/library/BookLibraryClient";

export default async function BookLibraryPage() {
  await requireDashboardAccess();
  return <BookLibraryClient />;
}
