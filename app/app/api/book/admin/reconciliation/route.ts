import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { reconcileStripeEntitlements } from "@/app/app/api/book/_lib/reconciliation";

export const runtime = "nodejs";
// NOTE (M13): do NOT add `export const maxDuration = ...` here. OpenNext bundles
// every route into the single `default` ServerFn (open-next.config.ts), whose CDK
// timeout is hard-set to 45s (infra/lib/chapterflow-frontend-stack.ts ServerFn).
// Next's per-route `maxDuration` is a Vercel-platform hint that OpenNext/Lambda
// does NOT honour, so declaring 60 here gave false confidence — Lambda still
// kills the handler at 45s. Raising the shared ServerFn timeout further is out (it would
// affect every route); a dedicated reconciliation Lambda needs new infra. Until
// then we keep the work bounded so it finishes inside 45s, and surface
// `truncated` loudly so a partial run is never mistaken for a clean one.

// Stripe pagination is the dominant cost (one network round-trip per page). Cap
// pages so the worst case (paginate + full-table entitlement scan) stays under
// the enforced 45s ServerFn budget. 8 pages × 100 = up to 800 live subs; beyond
// that the response is flagged `truncated` (which also disables the false-positive
// -prone "missed cancellation" pass in reconciliation-core).
const RECON_MAX_STRIPE_PAGES = 8;

/**
 * Admin billing reconciliation: compare live Stripe subscriptions against the
 * DynamoDB entitlements and report disagreements (missed webhooks, drift). Read
 * only — never mutates. Useful before trusting MRR, and to catch the rare
 * webhook that didn't land.
 *
 * Bounded to finish inside the 45s ServerFn timeout (see note above). When the
 * Stripe subscription list exceeds the page cap the response sets
 * `truncated: true` and an `incomplete` warning so a partial scan is never read
 * as a clean bill of health.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const [tableName, stripe] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
    ]);
    const result = await reconcileStripeEntitlements(stripe, tableName, {
      maxPages: RECON_MAX_STRIPE_PAGES,
    });
    return bookOk({
      generatedAt: new Date().toISOString(),
      ...result,
      ...(result.truncated
        ? {
            incomplete:
              "Stripe subscription list exceeded the page cap; results are partial " +
              "and the missed-cancellation check was skipped. Re-run or split by status.",
          }
        : {}),
    });
  });
}
