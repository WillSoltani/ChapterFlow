import "server-only";

import { headers } from "next/headers";
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
      const h = await headers();
      const host = h.get("x-forwarded-host") || h.get("host");
      const proto =
        h.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "production" ? "https" : "http");
      const currentOrigin = host ? `${proto}://${host}` : "";
      const returnTo = currentOrigin ? `${currentOrigin}/book` : "/book";

      redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
}
