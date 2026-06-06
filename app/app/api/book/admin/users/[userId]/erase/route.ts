import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, requireBodyObject, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookAnalyticsTableName, getBookTableName } from "@/app/app/api/book/_lib/env";
import { eraseUserData } from "@/app/app/api/book/_lib/account-erasure";

export const runtime = "nodejs";

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
