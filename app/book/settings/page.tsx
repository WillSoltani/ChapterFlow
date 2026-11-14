import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookAdminGroupName } from "@/app/app/api/book/_lib/env";
import { isUserInAdminGroup } from "@/app/app/api/book/_lib/admin-group-core";
import { BookSettingsClient } from "@/app/book/settings/BookSettingsClient";
import type { BillingInterval } from "@/app/book/hooks/useBookEntitlements";
import packageJson from "@/package.json";
import type { Metadata } from "next";

// SHELL-18: the /book layout's template adds " | ChapterFlow".
export const metadata: Metadata = { title: "Settings" };

/** The upgrade deep-link (e.g. from the landing "Annual" toggle) may carry a
 *  `plan` hint so the billing card pre-selects that interval. Validate it before
 *  trusting it — anything unrecognized is ignored (settings picks its default). */
function parsePlanHint(value: string | string[] | undefined): BillingInterval | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "monthly" || v === "annual" || v === "annual_upfront" ? v : undefined;
}

export default async function BookSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireDashboardAccess();

  const params = await searchParams;
  const initialUpgradeInterval = parsePlanHint(params.plan);
  // `upgrade=1` (UPGRADE_RETURN_PATH): open Account and focus the subscription card.
  const upgradeParam = Array.isArray(params.upgrade) ? params.upgrade[0] : params.upgrade;
  const openUpgrade = upgradeParam === "1";

  let userEmail: string | null = null;
  let isAdmin = false;

  try {
    const user = await requireUser();
    userEmail = user.email ?? null;

    // Admin status is Cognito-group membership — the SAME mechanism the API's
    // `requireAdminUser()` enforces. The previous `ADMIN_SUBS`/`ADMIN_EMAILS`
    // allowlist was read via raw `process.env`, which is NOT injected into the
    // prod OpenNext Lambda (see CLAUDE.md env model), so it was always empty in
    // prod and `isAdmin` was permanently false. `cognito:groups` rides on the
    // verified id_token, so it works everywhere with no extra injection.
    const adminGroup = await getBookAdminGroupName();
    isAdmin = isUserInAdminGroup(user.groups, adminGroup);
  } catch {
    isAdmin = false;
  }

  return (
    <BookSettingsClient
      isAdmin={isAdmin}
      userEmail={userEmail}
      appVersion={packageJson.version}
      initialUpgradeInterval={initialUpgradeInterval}
      openUpgrade={openUpgrade}
    />
  );
}
