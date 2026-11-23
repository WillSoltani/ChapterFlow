import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { LibraryPage } from "@/components/library/LibraryPage";

export const metadata = { title: "Library" };

export default async function BookLibraryPage() {
  await requireDashboardAccess();
  return <LibraryPage />;
}
