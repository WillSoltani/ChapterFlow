import { Suspense } from "react";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { WorkspacePage } from "@/components/workspace/WorkspacePage";
import { DashboardShellSkeleton } from "@/app/dashboard/loading";

export default async function DashboardRoute() {
  await requireDashboardAccess();
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <WorkspacePage />
    </Suspense>
  );
}
