import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { getActivePairWithPartner } from "@/app/app/api/book/_lib/pair-repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    // Returns the bare pair plus a PII-safe partner summary (display name +
    // coarse activity) so the accountability card isn't hollow. `pair` is kept
    // for backward compatibility with existing callers.
    const { pair, partner } = await getActivePairWithPartner(tableName, user.sub);
    return bookOk({ pair, partner });
  });
}
