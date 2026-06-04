import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getStripeClient } from "@/app/app/api/book/_lib/stripe-service";
import { reconcileStripeEntitlements } from "@/app/app/api/book/_lib/reconciliation";

export const runtime = "nodejs";
// Scans entitlements + paginates Stripe subscriptions — give it headroom.
export const maxDuration = 60;

/**
 * Admin billing reconciliation: compare live Stripe subscriptions against the
 * DynamoDB entitlements and report disagreements (missed webhooks, drift). Read
 * only — never mutates. Useful before trusting MRR, and to catch the rare
 * webhook that didn't land.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const [tableName, stripe] = await Promise.all([
      getBookTableName(),
      getStripeClient(),
    ]);
    const result = await reconcileStripeEntitlements(stripe, tableName);
    return bookOk({ generatedAt: new Date().toISOString(), ...result });
  });
}
