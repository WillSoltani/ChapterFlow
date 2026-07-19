import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import { getGiftCode, redeemGiftCode } from "@/app/app/api/book/_lib/gift-repo";
import { GIFT_PRO_DAYS } from "../../_constants";

export const runtime = "nodejs";

const PRO_DAYS = GIFT_PRO_DAYS;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { code } = await params;
    const normalizedCode = code.toUpperCase();

    const tableName = await getBookTableName();

    // Look up the gift code.
    const gift = await getGiftCode(tableName, normalizedCode);
    if (!gift) {
      throw new BookApiError(404, "gift_not_found", "Gift code not found.");
    }
    if (gift.status === "redeemed") {
      throw new BookApiError(400, "already_redeemed", "This gift code has already been redeemed.");
    }
    if (gift.status === "expired") {
      throw new BookApiError(400, "gift_expired", "This gift code has expired.");
    }
    if (gift.giverUserId === user.sub) {
      throw new BookApiError(400, "self_redeem", "You cannot redeem your own gift code.");
    }

    const now = nowIso();
    const proExpires = new Date(Date.now() + PRO_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Atomically: mark code as redeemed + grant Pro to the claimant. Extracted
    // verbatim into gift-repo.ts (WS3-002) — the TransactWriteCommand shape and
    // the TransactionCanceledException → typed BookApiError mapping (already
    // redeemed / dispute hold / active subscription / longer grant active) are
    // unchanged.
    await redeemGiftCode(tableName, {
      normalizedCode,
      userId: user.sub,
      now,
      proExpires,
    });

    return bookOk({
      redeemed: true,
      giftType: gift.giftType ?? "pro_week",
      proDays: PRO_DAYS,
      proExpiresAt: proExpires,
      message: `You've been gifted ${PRO_DAYS} days of Pro access!`,
    });
  });
}
