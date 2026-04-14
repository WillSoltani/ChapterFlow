// The admin layout (app/book/admin/layout.tsx) already gates access via
// requireAdminUser() + requireDashboardAccess(), so this page just renders.
import { AdminEventsClient } from "./AdminEventsClient";

export default function AdminEventsPage() {
  return <AdminEventsClient />;
}
