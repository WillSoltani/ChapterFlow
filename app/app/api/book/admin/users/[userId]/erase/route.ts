import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { requireRecentAuth } from "@/app/app/api/_lib/auth";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { eraseUserData } from "@/app/app/api/book/_lib/account-erasure";

export const runtime = "nodejs";

/**
 * Step-up window: irreversible hard-erasure requires the ADMIN to have signed in
 * within the last 5 minutes (tighter than self-delete's 10 — this is a
 * privileged, irreversible action against another user's data).
 */
const ERASE_MAX_AUTH_AGE_MINUTES = 5;

/**
 * POST /app/api/book/admin/users/[userId]/erase
 *
 * IRREVERSIBLE hard erasure of a user's data across the main table, analytics
 * table, Stripe, and Cognito — for honouring "complete erasure" requests
 * (the privacy policy points users at support for this).
 *
 * Requires body: { confirm: "ERASE" } as a server-side safety guard.
 * Admin-only. Returns a per-store summary including residual warnings.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    // Step-up auth (#5): require the admin to have authenticated within the last
    // 5 minutes before an irreversible erasure. Runs AFTER requireAdminUser
    // (which authenticates + checks the account-status guard + admin group), so
    // recency is decided on an already-validated, already-authorized admin.
    requireRecentAuth(admin, ERASE_MAX_AUTH_AGE_MINUTES);
    const { userId } = await params;
    if (!userId) throw new BookApiError(400, "invalid_user_id", "userId is required.");

    const body = requireBodyObject(await req.json().catch(() => ({})));
    if (body.confirm !== "ERASE") {
      throw new BookApiError(
        400,
        "confirmation_required",
        'Request body must include { "confirm": "ERASE" }.'
      );
    }

    const tableName = await getBookTableName();
    const analyticsTable = await getBookAnalyticsTableName();

    const result = await eraseUserData(tableName, analyticsTable, userId, `admin:${admin.sub}`);
    return bookOk({ success: true, result });
  });
}
