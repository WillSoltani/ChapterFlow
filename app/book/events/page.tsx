import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { EventsClient } from "./EventsClient";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  await requireDashboardAccess();
  return <EventsClient />;
}
