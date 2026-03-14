import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { BookProfileClient } from "@/app/book/profile/BookProfileClient";

export default async function BookProfilePage() {
  await requireDashboardAccess();

  let userEmail: string | null = null;
  try {
    const user = await requireUser();
    userEmail = user.email ?? null;
  } catch {
    userEmail = null;
  }

  return <BookProfileClient userEmail={userEmail} appVersion="0.1.0" />;
}
