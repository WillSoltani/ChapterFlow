import { Suspense } from "react";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { WorkspacePage } from "@/components/workspace/WorkspacePage";

export default async function DashboardRoute() {
  await requireDashboardAccess();
  return (
    <Suspense>
      <WorkspacePage />
    </Suspense>
  );
}
