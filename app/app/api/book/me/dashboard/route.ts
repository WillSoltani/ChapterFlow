import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  listPublishedCatalogItems,
  getUserEntitlement,
  getUserProfileItem,
  getUserSettingsItem,
  listAllUserBookStates,
  listAllUserProgress,
  listBadgeAwards,
  listReadingDays,
  listSavedBooks,
  listUserChapterStates,
} from "@/app/app/api/book/_lib/repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const tableName = await getBookTableName();

    const [
      catalog,
      entitlement,
      profile,
      settings,
      progress,
      bookStates,
      chapterStates,
      saved,
      readingDays,
      badgeAwards,
    ] = await Promise.all([
      listPublishedCatalogItems(tableName),
      getUserEntitlement(tableName, user.sub),
      getUserProfileItem(tableName, user.sub),
      getUserSettingsItem(tableName, user.sub),
      listAllUserProgress(tableName, user.sub),
      listAllUserBookStates(tableName, user.sub),
      listUserChapterStates(tableName, user.sub),
      listSavedBooks(tableName, user.sub),
      listReadingDays(tableName, user.sub),
      listBadgeAwards(tableName, user.sub),
    ]);

    return bookOk({
      catalog: catalog.filter((item) => item.status === "PUBLISHED" && !!item.currentPublishedVersion),
      entitlement,
      profile: profile?.profile ?? null,
      settings: settings?.settings ?? null,
      progress,
      bookStates,
      chapterStates,
      saved,
      readingDays,
      badgeAwards,
    });
  });
}
