import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { bookOk, requireBodyObject, requireString, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import {
  listNotificationsPage,
  countUnreadNotifications,
  markNotificationRead,
} from "@/app/app/api/book/_lib/notifications-repo";
import { notificationSk } from "@/app/app/api/book/_lib/keys";
import {
  decodeListCursor,
  encodeListCursor,
  parseListPaginationParams,
} from "@/app/app/api/book/_lib/list-pagination-core";

export const runtime = "nodejs";

// Notifications have no TTL and grow for the life of the account, so the bell
// fetches a bounded display page and gets the unread badge from a COUNT query
// instead of reading the whole partition into memory on every poll.
const NOTIFICATION_PAGE_SIZE = 50;
const NOTIFICATION_MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    // WS4-004: `?limit=&cursor=` — absent params reproduce the exact prior
    // first-page behavior (limit=NOTIFICATION_PAGE_SIZE, no start key).
    const url = new URL(req.url);
    const params = parseListPaginationParams(url, {
      defaultLimit: NOTIFICATION_PAGE_SIZE,
      maxLimit: NOTIFICATION_MAX_PAGE_SIZE,
    });
    const exclusiveStartKey = params.cursor
      ? decodeListCursor<Record<string, unknown>>(params.cursor)
      : undefined;

    const [page, unreadCount] = await Promise.all([
      listNotificationsPage(tableName, user.sub, { limit: params.limit, exclusiveStartKey }),
      countUnreadNotifications(tableName, user.sub),
    ]);

    return bookOk({
      notifications: page.items,
      unreadCount,
      items: page.items,
      nextCursor: page.lastEvaluatedKey ? encodeListCursor(page.lastEvaluatedKey) : null,
      hasMore: Boolean(page.lastEvaluatedKey),
    });
  });
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
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
