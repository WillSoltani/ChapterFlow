import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { EventsClient } from "./EventsClient";

export const metadata = { title: "Reading Events — ChapterFlow" };

export default async function EventsPage() {
  await requireDashboardAccess();
  return <EventsClient />;
}
