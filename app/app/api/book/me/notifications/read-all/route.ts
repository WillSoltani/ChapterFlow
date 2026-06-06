import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { markAllNotificationsRead } from "@/app/app/api/book/_lib/notifications-repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();
    const count = await markAllNotificationsRead(tableName, user.sub);
    return bookOk({ markedRead: count });
  });
}
