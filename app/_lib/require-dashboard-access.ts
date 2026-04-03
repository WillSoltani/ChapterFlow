import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAccountStatus, setAccountStatus } from "@/app/app/api/book/_lib/repo";

let warnedLocalBypass = false;

export async function requireDashboardAccess() {
  if (
    process.env.NODE_ENV !== "production" &&
    (isDevAuthBypassEnabled() ||
      !process.env.COGNITO_REGION ||
      !process.env.COGNITO_USER_POOL_ID ||
      !process.env.COGNITO_CLIENT_ID)
  ) {
    if (!warnedLocalBypass) {
      warnedLocalBypass = true;
      console.warn(
        "dashboard_access_dev_bypass: allowing local access because DEV_AUTH_BYPASS is enabled or Cognito env vars are missing in dev."
      );
    }
    return;
  }

  let userId: string;
  try {
    const user = await requireUser();
    userId = user.sub;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      redirect(`/auth/login?returnTo=${encodeURIComponent("/book")}`);
    }
    throw error;
  }

  // Check account lifecycle status — block deactivated/deleted users
  try {
    const tableName = await getBookTableName();
    const status = await getAccountStatus(tableName, userId);
    if (status?.status === "deactivated") {
      // Auto-reactivate on page load (user signed back in)
      await setAccountStatus(tableName, userId, "active", {
        statusReason: "user_reactivated",
      });
      return;
    }
    if (status?.status === "deleted") {
      redirect("/auth/login?reason=deleted");
    }
  } catch (error: unknown) {
    // If it's a redirect, re-throw it (Next.js redirect throws an error)
    if (error && typeof error === "object" && "digest" in error) throw error;
    // For DynamoDB errors, don't block the user — fail open
    console.error("account_status_check_error", error);
  }
}
