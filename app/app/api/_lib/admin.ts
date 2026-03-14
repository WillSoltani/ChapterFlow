import "server-only";

import { requireUser, type AuthedUser } from "./auth";

function splitCsv(v: string | undefined): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeEmail(v: string | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

function isAllowedAdmin(user: AuthedUser): boolean {
  const allowedSubs = new Set(splitCsv(process.env.ADMIN_SUBS));
  const allowedEmails = new Set(
    splitCsv(process.env.ADMIN_EMAILS).map((email) => normalizeEmail(email))
  );

  if (allowedSubs.size === 0 && allowedEmails.size === 0) {
    return false;
  }

  if (allowedSubs.has(user.sub)) return true;
  if (user.email && allowedEmails.has(normalizeEmail(user.email))) return true;
  return false;
}

export async function requireAdminUser(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!isAllowedAdmin(user)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

