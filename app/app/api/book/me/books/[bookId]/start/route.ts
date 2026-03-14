import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { withBookApiErrors, bookOk } from "@/app/app/api/book/_lib/http";
import { getBookFreeSlotsDefault, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  createProgressIfMissing,
  getBookVersion,
  getCatalogBook,
  getUserEntitlement,
  getUserProgress,
  reserveBookEntitlement,
} from "@/app/app/api/book/_lib/repo";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { nowIso } from "@/app/app/api/book/_lib/keys";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookId: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId } = await params;
    if (!bookId) {
      throw new BookApiError(400, "invalid_book_id", "bookId is required.");
    }

    const tableName = await getBookTableName();
    const catalog = await getCatalogBook(tableName, bookId);
    if (!catalog?.currentPublishedVersion || catalog.status !== "PUBLISHED") {
      throw new BookApiError(404, "book_not_found", "Book is not available.");
    }
    const version = await getBookVersion(tableName, bookId, catalog.currentPublishedVersion);
    if (!version) {
      throw new BookApiError(404, "book_version_not_found", "Book version is missing.");
    }

    const freeSlotsDefault = await getBookFreeSlotsDefault();

    let entitlement;
    try {
      entitlement = await reserveBookEntitlement(tableName, {
        userId: user.sub,
        bookId,
        freeSlotsDefault,
      });
    } catch (error: unknown) {
      if (error instanceof BookApiError && error.code === "book_limit_reached") {
        const currentEntitlement = await getUserEntitlement(tableName, user.sub);
        const freeBookSlots = currentEntitlement?.freeBookSlots ?? freeSlotsDefault;
        const unlockedBooksCount = currentEntitlement?.unlockedBookIds.length ?? 0;
        throw new BookApiError(
          402,
          "paywall_book_limit",
          "You have reached your free book limit. Upgrade to Pro to continue.",
          {
            unlockedBooksCount,
            freeBookSlots,
            price: "$7.99/month",
            benefits: [
              "Unlock unlimited books",
              "Keep progress synced across devices",
              "Get access to future advanced modes",
            ],
          }
        );
      }
      throw error;
    }

    const ts = nowIso();
    await createProgressIfMissing(tableName, {
      userId: user.sub,
      bookId,
      pinnedBookVersion: version.version,
      contentPrefix: version.contentPrefix,
      manifestKey: version.manifestKey,
      currentChapterNumber: 1,
      unlockedThroughChapterNumber: 1,
      completedChapters: [],
      bestScoreByChapter: {},
      lastOpenedAt: ts,
      lastActiveAt: ts,
      streakDays: 0,
      updatedAt: ts,
      createdAt: ts,
    });

    const progress = await getUserProgress(tableName, user.sub, bookId);
    if (!progress) {
      throw new BookApiError(500, "progress_init_failed", "Could not initialize progress.");
    }

    return bookOk({
      bookId,
      entitlement: {
        plan: entitlement.plan,
        proStatus: entitlement.proStatus ?? "inactive",
        freeBookSlots: entitlement.freeBookSlots,
        unlockedBookIds: entitlement.unlockedBookIds,
      },
      progress: {
        pinnedBookVersion: progress.pinnedBookVersion,
        currentChapterNumber: progress.currentChapterNumber,
        unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
        completedChapters: progress.completedChapters,
      },
    });
  });
}
