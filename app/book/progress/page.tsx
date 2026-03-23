import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { ProgressPage } from "@/components/progress/ProgressPage";

export default async function BookProgressPage() {
  await requireDashboardAccess();
  return <ProgressPage />;
}
