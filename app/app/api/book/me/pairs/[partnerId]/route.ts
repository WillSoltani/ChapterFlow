import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getUserActivePair, deletePair } from "@/app/app/api/book/_lib/pair-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ partnerId: string }> };

export async function DELETE(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const { partnerId } = await ctx.params;

    const pair = await getUserActivePair(tableName, user.sub);
    if (!pair || pair.partnerId !== partnerId) {
      return bookErr(req, 404, "pair_not_found", "No active pair with this partner");
    }

    await deletePair(tableName, user.sub, partnerId);

    return bookOk({ ended: true });
  });
}
