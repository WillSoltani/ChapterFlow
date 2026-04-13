import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { JourneyDetailClient } from "./JourneyDetailClient";

export const metadata = { title: "Journey — ChapterFlow" };

export default async function JourneyDetailPage() {
  await requireDashboardAccess();
  return <JourneyDetailClient />;
}
