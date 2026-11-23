import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { SavedBooksClient } from "@/app/book/saved/SavedBooksClient";

export const metadata = { title: "Read Next" };

export default async function SavedBooksPage() {
  await requireDashboardAccess();
  return <SavedBooksClient />;
}
