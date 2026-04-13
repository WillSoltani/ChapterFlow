import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { AdminEventsClient } from "./AdminEventsClient";

export default async function AdminEventsPage() {
  await requireDashboardAccess();
  return <AdminEventsClient />;
}
