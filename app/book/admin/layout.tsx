import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAdminGroupName } from "@/app/app/api/book/_lib/env";
import { AdminShell } from "@/app/book/admin/_components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin access is gated by the Cognito admin-group check below, not by the
  // consumer onboarding flow — so opt out of the onboarding redirect here.
  // Without this, an admin who never completed consumer onboarding would be
  // bounced to /book before the group check could grant them the admin panel.
  await requireDashboardAccess({ allowUnonboarded: true });
  const user = await requireUser();
  const adminGroup = await getBookAdminGroupName();
  const groups = user.groups ?? [];
  if (!groups.includes(adminGroup)) {
    redirect("/book/home");
  }

  return <AdminShell userEmail={user.email}>{children}</AdminShell>;
}
