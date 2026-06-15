import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { NotebookClient } from "./NotebookClient";

export const metadata = {
  title: "Notebook — ChapterFlow",
};

export default async function NotebookPage() {
  await requireDashboardAccess();
  return <NotebookClient />;
}
