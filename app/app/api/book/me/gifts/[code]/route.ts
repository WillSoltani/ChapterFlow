import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { giftCodePk, giftCodeSk } from "@/app/app/api/book/_lib/keys";
import { getUserProfileItem } from "@/app/app/api/book/_lib/repo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { GIFT_PRO_DAYS } from "../_constants";

export const runtime = "nodejs";

/**
 * GET — preview a gift code before the irreversible claim. Lets the recipient
 * see what the gift is (a Pro window), who sent it, and whether it's still
 * claimable, so the gift page can render a real "X sent you a free week of
 * ChapterFlow Pro" moment instead of revealing the value only after claiming.
 *
 * Returns only the giver's chosen display name (never their email or id), and
 * only to a signed-in user who already holds the secret code.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const { code } = await params;
    const normalizedCode = code.toUpperCase();
    const tableName = await getBookTableName();

    const codeRes = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: giftCodePk(), SK: giftCodeSk(normalizedCode) },
      })
    );
    const gift = codeRes.Item;
    if (!gift) {
      throw new BookApiError(404, "gift_not_found", "Gift code not found.");
    }

    // Best-effort sender name (display name only). Never block the preview on it.
    let senderName: string | null = null;
    if (typeof gift.giverUserId === "string" && gift.giverUserId) {
      try {
        const profile = await getUserProfileItem(tableName, gift.giverUserId);
        const dn = profile?.profile?.displayName;
        if (typeof dn === "string" && dn.trim()) senderName = dn.trim();
      } catch {
        // ignore — sender stays anonymous
      }
    }

    const status =
      gift.status === "redeemed"
        ? "redeemed"
        : gift.status === "expired"
          ? "expired"
          : "available";

    return bookOk({
      status,
      giftType: gift.giftType ?? "pro_week",
      proDays: GIFT_PRO_DAYS,
      senderName,
      // The giver can't claim their own gift — surface it pre-commit so the
      // page can show a friendly note instead of a post-claim error.
      isOwnGift: gift.giverUserId === user.sub,
    });
  });
}
