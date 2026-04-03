import "server-only";
import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getLicenseKey, revokeLicenseKey } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

const LICENSE_KEY_RE = /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/**
 * GET /app/api/book/admin/license-keys/[code]
 *
 * Look up a single license key by code.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase().trim();

    if (!LICENSE_KEY_RE.test(code)) {
      throw new BookApiError(400, "invalid_code_format", "Expected CF-XXXX-XXXX-XXXX.");
    }

    const tableName = await getBookTableName();
    const key = await getLicenseKey(tableName, code);
    if (!key) {
      throw new BookApiError(404, "not_found", "License key not found.");
    }

    return bookOk({ key });
  });
}

/**
 * PATCH /app/api/book/admin/license-keys/[code]
 *
 * Revoke an available license key.
 * Body: { "action": "revoke" }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const { code: rawCode } = await params;
    const code = rawCode.toUpperCase().trim();

    if (!LICENSE_KEY_RE.test(code)) {
      throw new BookApiError(400, "invalid_code_format", "Expected CF-XXXX-XXXX-XXXX.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new BookApiError(400, "invalid_json", "Request body must be valid JSON.");
    }

    const action = (body as Record<string, unknown>)?.action;
    if (action !== "revoke") {
      throw new BookApiError(400, "invalid_action", 'Only "revoke" action is supported.');
    }

    const tableName = await getBookTableName();

    // Verify the key exists and is available
    const key = await getLicenseKey(tableName, code);
    if (!key) {
      throw new BookApiError(404, "not_found", "License key not found.");
    }
    if (key.status === "revoked") {
      throw new BookApiError(409, "already_revoked", "This key is already revoked.");
    }
    if (key.status === "redeemed") {
      throw new BookApiError(
        409,
        "already_redeemed",
        "Cannot revoke a key that has already been redeemed."
      );
    }

    await revokeLicenseKey(tableName, code);
    return bookOk({ message: `License key ${code} has been revoked.` });
  });
}
