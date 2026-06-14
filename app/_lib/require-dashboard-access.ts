import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getAccountStatus, setAccountStatus } from "@/app/app/api/book/_lib/repo";

let warnedLocalBypass = false;

/**
 * Best-effort recovery of the path the reader was actually trying to reach, so
 * the login redirect's returnTo lands them back there instead of the generic
 * "/book" dashboard. Normal logged-out navigation already gets an accurate
 * returnTo from middleware; this page-level guard only fires for the narrower
 * cases middleware can't catch (e.g. a cookie-present-but-INVALID_TOKEN), where
 * the only signal available to a Server Component is the request headers.
 *
 * We trust the path only when it is a same-origin, relative "/book…" path —
 * anything else (cross-origin, query-string returnTo loops, non-/book targets)
 * falls back to "/book" rather than building an open-redirect.
 */
async function resolveReturnTo(): Promise<string> {
  const FALLBACK = "/book";
  try {
    const h = await headers();
    // Prefer an explicit middleware-injected path header if present; otherwise
    // fall back to the Referer of the originating navigation.
    const explicit =
      h.get("x-pathname") ||
      h.get("x-invoke-path") ||
      h.get("next-url");
    const candidate = explicit || h.get("referer");
    if (!candidate) return FALLBACK;

    // Normalize to a path: accept a bare "/book…" path or an absolute URL.
    let path = candidate;
    if (/^https?:\/\//i.test(candidate)) {
      path = new URL(candidate).pathname + new URL(candidate).search;
    }
    if (path.startsWith("/book") && !path.startsWith("//")) return path;
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

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
      const returnTo = await resolveReturnTo();
      redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
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
