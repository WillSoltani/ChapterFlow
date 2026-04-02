import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import { listPublishedLibraryCatalog } from "@/app/app/api/book/_lib/library-catalog";
import {
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
import { getUserFlowPointsState } from "@/app/app/api/book/_lib/flow-points-repo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const [tableName, contentBucket] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
    ]);

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
      flowPointsState,
    ] = await Promise.all([
      listPublishedLibraryCatalog({ tableName, contentBucket }).catch(() => []),
      getUserEntitlement(tableName, user.sub).catch(() => null),
      getUserProfileItem(tableName, user.sub).catch(() => null),
      getUserSettingsItem(tableName, user.sub).catch(() => null),
      listAllUserProgress(tableName, user.sub).catch(() => []),
      listAllUserBookStates(tableName, user.sub).catch(() => []),
      listUserChapterStates(tableName, user.sub).catch(() => []),
      listSavedBooks(tableName, user.sub).catch(() => []),
      listReadingDays(tableName, user.sub).catch(() => []),
      listBadgeAwards(tableName, user.sub).catch(() => []),
      getUserFlowPointsState(tableName, user.sub).catch(() => ({ points: 0 })),
    ]);

    return bookOk({
      catalog,
      entitlement,
      profile: profile?.profile ?? null,
      settings: settings?.settings ?? null,
      progress,
      bookStates,
      chapterStates,
      saved,
      readingDays,
      badgeAwards,
      insightPointsBalance: flowPointsState.points,
    });
  });
}
