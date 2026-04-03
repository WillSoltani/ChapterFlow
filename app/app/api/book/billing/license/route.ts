import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  getBookAnalyticsTableName,
  getBookFreeSlotsDefault,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { getLicenseKey, getUserEntitlement, redeemLicenseKey } from "@/app/app/api/book/_lib/repo";
import { analyticsTrackLicenseAttempt } from "@/app/app/api/book/_lib/analytics-repo";

export const runtime = "nodejs";

/** Matches CF-XXXX-XXXX-XXXX where X is A-Z or 0-9 */
const LICENSE_KEY_RE = /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Fire-and-forget audit log. Never blocks the response. */
function logAttempt(
  analyticsTable: string | undefined,
  userId: string,
  code: string,
  outcome: "success" | "invalid_format" | "not_found" | "revoked" | "already_redeemed" | "already_subscribed" | "error",
  extra?: { errorCode?: string; validMonths?: number }
) {
  if (!analyticsTable) return;
  analyticsTrackLicenseAttempt(analyticsTable, {
    userId,
    code,
    outcome,
    ...extra,
  }).catch(() => {});
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();

    const body = await req.json().catch(() => null);
    const rawCode = typeof body?.code === "string" ? body.code : "";
    const code = rawCode.trim().toUpperCase();

    const [tableName, analyticsTable] = await Promise.all([
      getBookTableName(),
      getBookAnalyticsTableName(),
    ]);

    if (!LICENSE_KEY_RE.test(code)) {
      logAttempt(analyticsTable, user.sub, code || "(empty)", "invalid_format", {
        errorCode: "invalid_code_format",
      });
      throw new BookApiError(
        400,
        "invalid_code_format",
        "Invalid license key format. Expected CF-XXXX-XXXX-XXXX."
      );
    }

    // Reject if the user already has an active paid Stripe subscription — save the key for
    // someone who needs it. License-based PRO is allowed to be renewed before expiry.
    const existing = await getUserEntitlement(tableName, user.sub);
    if (existing?.plan === "PRO" && existing.proSource === "stripe") {
      logAttempt(analyticsTable, user.sub, code, "already_subscribed", {
        errorCode: "already_subscribed",
      });
      throw new BookApiError(
        409,
        "already_subscribed",
        "You already have an active Pro subscription via Stripe. License keys are for free-pass access only."
      );
    }

    // Look up the key
    const key = await getLicenseKey(tableName, code);
    if (!key) {
      logAttempt(analyticsTable, user.sub, code, "not_found", { errorCode: "invalid_code" });
      throw new BookApiError(404, "invalid_code", "This license key is not valid.");
    }
    if (key.status === "revoked") {
      logAttempt(analyticsTable, user.sub, code, "revoked", { errorCode: "code_revoked" });
      throw new BookApiError(400, "code_revoked", "This license key has been revoked.");
    }
    if (key.status === "redeemed") {
      logAttempt(analyticsTable, user.sub, code, "already_redeemed", {
        errorCode: "code_already_redeemed",
      });
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

    logAttempt(analyticsTable, user.sub, code, "success", {
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
