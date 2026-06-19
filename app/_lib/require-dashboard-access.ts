import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/app/api/_lib/auth";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getAccountStatus,
  setAccountStatus,
  getUserSettingsItem,
} from "@/app/app/api/book/_lib/repo";

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

/**
 * Server-side gate for every in-app route. Enforces (in order): authentication,
 * account lifecycle status, and onboarding completion. Un-onboarded signed-in
 * users are hard-redirected into the onboarding funnel (served at "/book") so
 * deep-linking past onboarding can't land them on a half-initialized page.
 *
 * @param options.allowUnonboarded - Set by the onboarding funnel pages
 *   themselves ("/book", "/onboarding"). They render the onboarding flow AND
 *   call this helper for the auth/account checks, so they must opt out of the
 *   un-onboarded redirect — otherwise the redirect target ("/book") would
 *   re-enter this helper and infinite-loop.
 */
export async function requireDashboardAccess(options?: {
  allowUnonboarded?: boolean;
}) {
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

  // Onboarding funnel gate — route signed-in-but-un-onboarded users into the
  // onboarding flow (served at "/book") rather than letting them deep-link onto
  // a half-initialized dashboard/library/settings page. This replaces the
  // fragile per-client-component `router.replace("/book")` convention with one
  // shared server-side check that every in-app route inherits. The funnel pages
  // themselves opt out via `allowUnonboarded` (see the doc comment).
  if (!options?.allowUnonboarded) {
    try {
      const tableName = await getBookTableName();
      const settingsItem = await getUserSettingsItem(tableName, userId);
      const onboarding = settingsItem?.settings?.onboarding as
        | { onboardingCompleted?: boolean }
        | undefined;
      if (!onboarding?.onboardingCompleted) {
        redirect("/book");
      }
    } catch (error: unknown) {
      // Re-throw the Next.js redirect (it's thrown, not returned).
      if (error && typeof error === "object" && "digest" in error) throw error;
      // Fail open on a DynamoDB/network hiccup — don't trap a legitimate user
      // out of the app over a transient backend error (mirrors the
      // account-status block above).
      console.error("onboarding_status_check_error", error);
    }
  }
}
