import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { BookSettingsClient } from "@/app/book/settings/BookSettingsClient";

function splitCsv(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export default async function BookSettingsPage() {
  await requireDashboardAccess();

  let userEmail: string | null = null;
  let isAdmin = false;

  try {
    const user = await requireUser();
    userEmail = user.email ?? null;

    const allowedSubs = new Set(splitCsv(process.env.ADMIN_SUBS));
    const allowedEmails = new Set(splitCsv(process.env.ADMIN_EMAILS).map(normalizeEmail));

    isAdmin = allowedSubs.has(user.sub) || (user.email ? allowedEmails.has(normalizeEmail(user.email)) : false);
  } catch {
    isAdmin = false;
  }

  return <BookSettingsClient isAdmin={isAdmin} userEmail={userEmail} appVersion="0.1.0" />;
}
