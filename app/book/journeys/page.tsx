import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { JourneysClient } from "./JourneysClient";

export const metadata = { title: "Learning Journeys — ChapterFlow" };

export default async function JourneysPage() {
  await requireDashboardAccess();
  return <JourneysClient />;
}
