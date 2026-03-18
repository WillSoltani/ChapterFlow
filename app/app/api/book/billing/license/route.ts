import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { getBookFreeSlotsDefault, getBookTableName } from "@/app/app/api/book/_lib/env";
import { getLicenseKey, getUserEntitlement, redeemLicenseKey } from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

/** Matches CF-XXXX-XXXX-XXXX where X is A-Z or 0-9 */
const LICENSE_KEY_RE = /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();

    const body = await req.json().catch(() => null);
    const rawCode = typeof body?.code === "string" ? body.code : "";
    const code = rawCode.trim().toUpperCase();

    if (!LICENSE_KEY_RE.test(code)) {
      throw new BookApiError(
        400,
        "invalid_code_format",
        "Invalid license key format. Expected CF-XXXX-XXXX-XXXX."
      );
    }

    const tableName = await getBookTableName();

    // Reject if the user already has an active paid Stripe subscription — save the key for
    // someone who needs it. License-based PRO is allowed to be renewed before expiry.
    const existing = await getUserEntitlement(tableName, user.sub);
    if (existing?.plan === "PRO" && existing.proSource === "stripe") {
      throw new BookApiError(
        409,
        "already_subscribed",
        "You already have an active Pro subscription via Stripe. License keys are for free-pass access only."
      );
    }

    // Look up the key
    const key = await getLicenseKey(tableName, code);
    if (!key) {
      throw new BookApiError(404, "invalid_code", "This license key is not valid.");
    }
    if (key.status === "revoked") {
      throw new BookApiError(400, "code_revoked", "This license key has been revoked.");
    }
    if (key.status === "redeemed") {
      throw new BookApiError(
        409,
        "code_already_redeemed",
        "This license key has already been claimed by someone else."
      );
    }

    // Atomically redeem the key and upgrade the user
    await redeemLicenseKey(tableName, {
      userId: user.sub,
      code,
      validMonths: key.validMonths,
    });

    // Return fresh entitlement so the client can update its state
    const defaultSlots = await getBookFreeSlotsDefault();
    const updated = await getUserEntitlement(tableName, user.sub);
    return bookOk({
      message: `Pro access activated. Your license expires in ${key.validMonths} month${key.validMonths === 1 ? "" : "s"}.`,
      entitlement: {
        plan: updated?.plan ?? "PRO",
        proStatus: updated?.proStatus ?? "active",
        proSource: updated?.proSource ?? "license",
        freeBookSlots: updated?.freeBookSlots ?? defaultSlots,
        unlockedBookIds: updated?.unlockedBookIds ?? [],
        licenseKey: updated?.licenseKey ?? code,
        licenseExpiresAt: updated?.licenseExpiresAt,
      },
    });
  });
}
