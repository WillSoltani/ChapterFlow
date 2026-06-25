import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { recordNudgeSent, getUserActivePair } from "@/app/app/api/book/_lib/pair-repo";
import { createNotification } from "@/app/app/api/book/_lib/notifications-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ partnerId: string }> };

export async function POST(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { partnerId } = await ctx.params;

    const pair = await getUserActivePair(tableName, user.sub);
    if (!pair || pair.partnerId !== partnerId) {
      return bookErr(req, 404, "pair_not_found", "No active pair with this partner");
    }

    // Atomically claim today's nudge slot. The daily cap is enforced by the
    // conditional write inside recordNudgeSent (not a separate read-then-write), so
    // two concurrent POSTs can't both pass the cap and double-notify the partner
    // (H15). Only the writer that actually claimed the slot proceeds to notify;
    // every other caller (same-day repeat or concurrent racer) gets nudge_limit.
    const claimed = await recordNudgeSent(tableName, user.sub, partnerId);
    if (!claimed) {
      return bookErr(req, 429, "nudge_limit", "You can only nudge once per day");
    }

    // Best-effort notification — don't fail the nudge if delivery errors
    try {
      await createNotification(tableName, {
        userId: partnerId,
        type: "partner_nudge",
        title: "Your reading partner nudged you!",
        body: "Time to pick up where you left off.",
      });
    } catch (err) {
      console.error("partner_nudge_notification_failed", { partnerId, err });
    }

    return bookOk({ sent: true });
  });
}
