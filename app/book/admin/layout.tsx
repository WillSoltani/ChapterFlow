import { redirect } from "next/navigation";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAdminGroupName } from "@/app/app/api/book/_lib/env";
import { AdminShell } from "@/app/book/admin/_components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireDashboardAccess();
  const user = await requireUser();
  const adminGroup = await getBookAdminGroupName();
  const groups = user.groups ?? [];
  if (!groups.includes(adminGroup)) {
    redirect("/book/home");
  }

  return <AdminShell userEmail={user.email}>{children}</AdminShell>;
}
