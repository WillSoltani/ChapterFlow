import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { AdminScenarioReviewClient } from "@/app/book/admin/scenarios/AdminScenarioReviewClient";

export default async function AdminScenariosPage() {
  await requireDashboardAccess();
  return <AdminScenarioReviewClient />;
}
