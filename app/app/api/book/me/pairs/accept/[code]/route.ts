import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { acceptPairInvite } from "@/app/app/api/book/_lib/pair-repo";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function POST(req: Request, ctx: Params) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const { code } = await ctx.params;
    const normalized = code.trim().toUpperCase();

    const result = await acceptPairInvite(tableName, normalized, user.sub);
    if (result.error) {
      return bookErr(req, 400, "pair_error", result.error);
    }

    return bookOk({ pair: result.pair, accepted: true });
  });
}
