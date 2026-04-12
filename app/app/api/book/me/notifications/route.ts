import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  listNotifications,
  markNotificationRead,
} from "@/app/app/api/book/_lib/notifications-repo";
import { notificationSk } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const notifications = await listNotifications(tableName, user.sub);
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return bookOk({ notifications, unreadCount });
  });
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const body = requireBodyObject(await req.json());
    const notificationId = requireString(body.notificationId, "notificationId", { maxLength: 100 });
    const createdAt = requireString(body.createdAt, "createdAt", { maxLength: 50 });

    const tableName = await getBookTableName();
    await markNotificationRead(
      tableName,
      user.sub,
      notificationSk(createdAt, notificationId)
    );
    return bookOk({ marked: true });
  });
}
