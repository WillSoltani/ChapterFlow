import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { createPairInvite, getUserActivePair } from "@/app/app/api/book/_lib/pair-repo";
import { getServerOrigin } from "@/app/app/_lib/server-origin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    const existing = await getUserActivePair(tableName, user.sub);
    if (existing) {
      return bookErr(req, 409, "already_paired", "You already have an active reading partner");
    }

    const invite = await createPairInvite(tableName, user.sub);
    const origin = await getServerOrigin();
    return bookOk({
      inviteCode: invite.inviteCode,
      inviteUrl: `${origin}/pair/${invite.inviteCode}`,
      expiresAt: invite.expiresAt,
    });
  });
}
