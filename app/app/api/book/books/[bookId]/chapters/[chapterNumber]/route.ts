import "server-only";
import { requireUser } from "@/app/app/api/_lib/auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookContentBucket, getBookTableName } from "@/app/app/api/book/_lib/env";
import {
  getUserAccessibleChapter,
  selectVariantFromQuery,
} from "@/app/app/api/book/_lib/content-service";
import { BookApiError } from "@/app/app/api/book/_lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookId: string; chapterNumber: string }> }
) {
  return withBookApiErrors(req, async () => {
    const user = await requireUser();
    const { bookId, chapterNumber } = await params;
    const chapterNum = Number(chapterNumber);
    if (!bookId || !Number.isFinite(chapterNum) || chapterNum < 1) {
      throw new BookApiError(400, "invalid_chapter", "Invalid chapter number.");
    }

    const tableName = await getBookTableName();
    const contentBucket = await getBookContentBucket();
    const { progress, chapter } = await getUserAccessibleChapter({
      tableName,
      contentBucket,
      userId: user.sub,
      bookId,
      chapterNumber: Math.floor(chapterNum),
    });

    const url = new URL(req.url);
    const requestedVariant = selectVariantFromQuery(url.searchParams.get("mode"));
    const defaultVariant = progress.preferredVariant;
    const activeVariant =
      (requestedVariant && chapter.contentVariants[requestedVariant] && requestedVariant) ||
      (defaultVariant && chapter.contentVariants[defaultVariant] && defaultVariant) ||
      Object.keys(chapter.contentVariants)[0];

    if (!activeVariant) {
      throw new BookApiError(500, "variant_missing", "No chapter variants are available.");
    }

    return bookOk({
      chapter: {
        chapterId: chapter.chapterId,
        number: chapter.number,
        title: chapter.title,
        readingTimeMinutes: chapter.readingTimeMinutes,
        activeVariant,
        availableVariants: Object.keys(chapter.contentVariants),
        content: chapter.contentVariants[activeVariant as keyof typeof chapter.contentVariants],
        examples: chapter.examples,
      },
      progress: {
        currentChapterNumber: progress.currentChapterNumber,
        unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
        completedChapters: progress.completedChapters,
      },
    });
  });
}
