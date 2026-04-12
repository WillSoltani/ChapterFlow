import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, bookErr, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { createPairInvite, getUserActivePair } from "@/app/app/api/book/_lib/pair-repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const existing = await getUserActivePair(tableName, user.sub);
    if (existing) {
      return bookErr(req, 409, "already_paired", "You already have an active reading partner");
    }

    const invite = await createPairInvite(tableName, user.sub);
    return bookOk({
      inviteCode: invite.inviteCode,
      inviteUrl: `https://chapterflow.siliconx.ca/pair/${invite.inviteCode}`,
      expiresAt: invite.expiresAt,
    });
  });
}
