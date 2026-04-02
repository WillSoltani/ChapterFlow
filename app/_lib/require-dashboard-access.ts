import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

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

  try {
    await requireUser();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
      // Use a simple relative path — login and callback are same-origin,
      // so there's no need to construct a full URL from headers.
      redirect(`/auth/login?returnTo=${encodeURIComponent("/book")}`);
    }
    throw error;
  }
}
