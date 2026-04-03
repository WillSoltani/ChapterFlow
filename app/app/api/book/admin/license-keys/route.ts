import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { listLicenseKeys } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/**
 * GET /app/api/book/admin/license-keys?status=available
 *
 * List all license keys. Optionally filter by status.
 * Returns keys sorted by code, with inventory summary.
 */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const statusFilter =
      statusParam === "available" || statusParam === "redeemed" || statusParam === "revoked"
        ? statusParam
        : undefined;

    const keys = await listLicenseKeys(tableName, statusFilter);

    // Build inventory summary
    const summary = { total: keys.length, available: 0, redeemed: 0, revoked: 0 };
    for (const key of keys) {
      if (key.status === "available") summary.available++;
      else if (key.status === "redeemed") summary.redeemed++;
      else if (key.status === "revoked") summary.revoked++;
    }

    return bookOk({ summary, keys });
  });
}
