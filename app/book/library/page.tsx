import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { LibraryPage } from "@/components/library/LibraryPage";

export default async function BookLibraryPage() {
  await requireDashboardAccess();
  return <LibraryPage />;
}
