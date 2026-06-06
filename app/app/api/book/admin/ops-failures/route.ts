import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getOpsFailure,
  listRecentOpsFailures,
  resolveOpsFailure,
  stripeErrorParts,
} from "@/app/app/api/book/_lib/ops-failure-repo";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";

export const runtime = "nodejs";

/**
 * GET /app/api/book/admin/ops-failures?includeResolved=1&limit=50
 *
 * Lists operational failures for the admin Ops dashboard (newest first).
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const url = new URL(req.url);
    const includeResolved = url.searchParams.get("includeResolved") === "1";
    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const failures = await listRecentOpsFailures(tableName, { limit, includeResolved });
    return bookOk({ failures });
  });
}

/**
 * POST /app/api/book/admin/ops-failures
 *
 * Body: { ref, action: "retry" | "resolve", note? }
 *  - "resolve": mark the failure handled (operator dealt with it out-of-band).
 *  - "retry":   re-attempt the failed Stripe cancellation. A subscription that
 *               is already gone (resource_missing) counts as success.
 *
 * On a successful retry the record is auto-resolved.
 */
type OpsActionResult = {
  success: true;
  alreadyResolved?: boolean;
  resolved?: boolean;
  note?: string;
};

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();

    const body = requireBodyObject(await req.json().catch(() => ({})));
    const ref = requireString(body.ref, "ref", { maxLength: 200 });
    const action = requireString(body.action, "action");
    if (action !== "retry" && action !== "resolve") {
      throw new BookApiError(400, "invalid_action", 'action must be "retry" or "resolve".');
    }

    const failure = await getOpsFailure(tableName, ref);
    if (!failure) {
      throw new BookApiError(404, "ops_failure_not_found", "That operational failure record no longer exists.");
    }
    if (failure.resolvedAt) {
      return bookOk<OpsActionResult>({ success: true, alreadyResolved: true });
    }

    if (action === "resolve") {
      const note = typeof body.note === "string" ? body.note : "manually resolved by admin";
      await resolveOpsFailure(tableName, ref, { resolvedBy: admin.sub, note });
      return bookOk<OpsActionResult>({ success: true, resolved: true });
    }

    // action === "retry" — only the two cancellation kinds are retryable here.
    // Erasure-side failures (stripe_customer_delete, cognito_delete) are not
    // re-attempted through this path; resolve them after handling out-of-band.
    if (failure.kind !== "stripe_cancel" && failure.kind !== "stripe_cancel_at_period_end") {
      throw new BookApiError(
        422,
        "retry_not_supported",
        `Retry is not supported for "${failure.kind}" failures — handle it directly, then Resolve.`,
      );
    }
    if (!failure.subscriptionId) {
      throw new BookApiError(
        422,
        "retry_not_possible",
        "This failure has no Stripe subscription id to retry.",
      );
    }

    try {
      const stripe = await getStripeClient();
      if (failure.kind === "stripe_cancel") {
        await stripe.subscriptions.cancel(failure.subscriptionId);
      } else {
        await stripe.subscriptions.update(failure.subscriptionId, {
          cancel_at_period_end: true,
        });
      }
    } catch (error) {
      const { code, message } = stripeErrorParts(error);
      // The subscription is already gone — the original intent is satisfied.
      if (code === "resource_missing") {
        await resolveOpsFailure(tableName, ref, {
          resolvedBy: admin.sub,
          note: "retry: subscription already absent (resource_missing)",
        });
        return bookOk<OpsActionResult>({ success: true, resolved: true, note: "subscription already absent" });
      }
      throw new BookApiError(502, "stripe_retry_failed", `Stripe retry failed: ${message}`, { code });
    }

    await resolveOpsFailure(tableName, ref, {
      resolvedBy: admin.sub,
      note: "retry succeeded",
    });
    return bookOk<OpsActionResult>({ success: true, resolved: true });
  });
}
