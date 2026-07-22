import "server-only";

import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  classifyDashboardReads,
  type DashboardSource,
} from "@/app/app/api/book/me/dashboard/dashboard-partial";
import { getAppBaseUrl, getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
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
    const user = await requireActiveBookUser();
    const [tableName, contentBucket, appBaseUrl] = await Promise.all([
      getBookTableName(),
      getBookContentBucket(),
      getAppBaseUrl(req.url),
    ]);

    // Fan out every read, but split CRITICAL from OPTIONAL (#2). Critical reads
    // (catalog, entitlement, progress, bookStates, chapterStates) are NOT
    // .catch'd to defaults — a failure must NOT masquerade as an empty catalog or
    // a false-FREE entitlement; instead the whole route fails loud with a 503 so
    // the client shows a retryable error (never collapses to FREE). Optional reads
    // still degrade to a default, but each failure is recorded in `warnings` and
    // flips `partial:true` so the client can say "couldn't load everything".
    const [
      catalogR,
      entitlementR,
      progressR,
      bookStatesR,
      chapterStatesR,
      profileR,
      settingsR,
      savedR,
      readingDaysR,
      badgeAwardsR,
      flowPointsStateR,
    ] = await Promise.allSettled([
      listPublishedLibraryCatalog({ tableName, contentBucket, appBaseUrl }),
      getUserEntitlement(tableName, user.sub),
      listAllUserProgress(tableName, user.sub),
      listAllUserBookStates(tableName, user.sub),
      listUserChapterStates(tableName, user.sub),
      getUserProfileItem(tableName, user.sub),
      getUserSettingsItem(tableName, user.sub),
      listSavedBooks(tableName, user.sub),
      listReadingDays(tableName, user.sub),
      listBadgeAwards(tableName, user.sub),
      getUserFlowPointsState(tableName, user.sub),
    ]);

    // Typed as the EXHAUSTIVE record (not the Partial alias) so tsc REQUIRES
    // exactly the full set of sources here — a dropped/renamed/extra key against
    // the CRITICAL/OPTIONAL constants in dashboard-partial.ts is a typecheck
    // error rather than a silent always-failed classification.
    const outcomes: Record<DashboardSource, boolean> = {
      catalog: catalogR.status === "fulfilled",
      entitlement: entitlementR.status === "fulfilled",
      progress: progressR.status === "fulfilled",
      bookStates: bookStatesR.status === "fulfilled",
      chapterStates: chapterStatesR.status === "fulfilled",
      profile: profileR.status === "fulfilled",
      settings: settingsR.status === "fulfilled",
      saved: savedR.status === "fulfilled",
      readingDays: readingDaysR.status === "fulfilled",
      badgeAwards: badgeAwardsR.status === "fulfilled",
      insightPoints: flowPointsStateR.status === "fulfilled",
    };

    const decision = classifyDashboardReads(outcomes);
    if (
      !decision.ok ||
      catalogR.status !== "fulfilled" ||
      entitlementR.status !== "fulfilled" ||
      progressR.status !== "fulfilled" ||
      bookStatesR.status !== "fulfilled" ||
      chapterStatesR.status !== "fulfilled"
    ) {
      // At least one critical read failed — fail loud, never serve a partial-but-
      // plausible dashboard that the client would misread as authoritative. (The
      // per-result status checks are redundant with `decision.ok` but also narrow
      // the `PromiseSettledResult` union so the values below are typed.)
      throw new BookApiError(
        503,
        "dashboard_unavailable",
        "We couldn't load your dashboard right now. Please try again.",
        { failedSources: decision.failedCritical },
      );
    }

    // Critical reads all succeeded — safe to read their values.
    const catalog = catalogR.value;
    const entitlement = entitlementR.value;
    const progress = progressR.value;
    const bookStates = bookStatesR.value;
    const chapterStates = chapterStatesR.value;

    // Optional reads degrade to a default when they failed.
    const profile = profileR.status === "fulfilled" ? profileR.value : null;
    const settings = settingsR.status === "fulfilled" ? settingsR.value : null;
    const saved = savedR.status === "fulfilled" ? savedR.value : [];
    const readingDays = readingDaysR.status === "fulfilled" ? readingDaysR.value : [];
    const badgeAwards = badgeAwardsR.status === "fulfilled" ? badgeAwardsR.value : [];
    const insightPointsBalance =
      flowPointsStateR.status === "fulfilled" ? flowPointsStateR.value.points : 0;

    // Respect the user's "Save Reading History" preference — if opted out,
    // return an empty readingDays array so the heatmap shows nothing.
    const privacy = settings?.settings?.privacy as
      | { saveReadingHistory?: boolean }
      | undefined;
    const saveReadingHistory = privacy?.saveReadingHistory ?? true;

    return bookOk({
      catalog,
      entitlement,
      profile: profile?.profile ?? null,
      settings: settings?.settings ?? null,
      progress,
      bookStates,
      chapterStates,
      saved,
      readingDays: saveReadingHistory ? readingDays : [],
      badgeAwards,
      insightPointsBalance,
      // Additive: tells the client some OPTIONAL data couldn't be loaded so it can
      // show a non-blocking "couldn't load everything" banner. Absent/false on a
      // fully-healthy response.
      partial: decision.partial,
      warnings: decision.warnings,
    });
  });
}
