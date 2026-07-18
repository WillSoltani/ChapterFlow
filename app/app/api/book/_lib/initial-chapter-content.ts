import "server-only";

import { requireUser } from "@/app/app/api/_lib/auth";
import { getBookContentBucket, getBookTableName } from "./env";
import { BookApiError } from "./errors";
import { getUserAccessibleChapter } from "./content-service";
import { getPublishedLibraryBookDetail } from "./library-catalog";
import { runAuthorizedChapterHydration } from "./initial-chapter-content-core";
import { getUserEntitlement } from "./repo";
import { findLibraryChapterSummary } from "@/app/book/_lib/library-data";
import type { ApiChapterResponse } from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";

/**
 * Server-hydrate the reader's ENTRY chapter content (WS3-024).
 *
 * The reader client normally fetches `GET /books/{bookId}/chapters/{n}` on mount
 * (useChapterContent). This loader lets the server page render real content into
 * the initial HTML by calling the SAME underlying loader that route uses
 * (`getUserAccessibleChapter`) directly — no HTTP hop.
 *
 * GATING — this first requires the CURRENT entitlement to grant the book, then
 * runs the content route's READ authorization (`getUserAccessibleChapter`:
 * requires a started progress row, then enforces `chapterNumber <=
 * unlockedThroughChapterNumber`). It does NOT run
 * `ensureUserBookStarted` — the paywall/entitlement RESERVATION — because that
 * is a mutation with side effects (progress create, slot reservation, points,
 * device cookies) that must not fire from a page render. The client's
 * `POST /me/books/{bookId}/start` still owns the paywall/blocked state machine
 * exactly as before.
 *
 * Consequently this hydrates content ONLY for a viewer whose current plan or
 * Free unlocked-book set grants access, who has progress, AND whose target
 * chapter is unlocked. Every other case — not-started /
 * paywalled / locked / logged-out / missing-env / S3 miss — FAILS CLOSED to
 * `null`, so the client's fetch + `/start` gates own the outcome unchanged.
 * A blocked user is therefore NEVER server-hydrated with content.
 *
 * Uses the React-cached `getPublishedLibraryBookDetail`, so when the page loads
 * the book detail concurrently (Promise.all) the manifest is read once, not
 * twice — the content read adds only its own progress + chapter S3 reads.
 */
export async function loadInitialChapterContent(
  bookId: string,
  chapterParam: string,
): Promise<ApiChapterResponse | null> {
  try {
    const user = await requireUser();
    const tableName = await getBookTableName();
    const entitlement = await getUserEntitlement(tableName, user.sub);

    return await runAuthorizedChapterHydration({
      entitlement,
      bookId,
      load: async () => {
        const contentBucket = await getBookContentBucket();
        const book = await getPublishedLibraryBookDetail({ tableName, contentBucket, bookId });
        const chapter = findLibraryChapterSummary(book, chapterParam);
        if (!chapter) return null;

        const { progress, chapter: payload } = await getUserAccessibleChapter({
          tableName,
          contentBucket,
          userId: user.sub,
          bookId,
          chapterNumber: chapter.number,
        });

        // Mirror the chapter route's response shape (books/[bookId]/chapters/[n])
        // WITHOUT a `mode` query, so the client adapter reconstructs an identical
        // chapter. `activeVariant`/`content` are back-compat fields the adapter does
        // not read (it uses `contentVariants`); included for shape parity.
        const defaultVariant = progress.preferredVariant;
        const activeVariant =
          (defaultVariant && payload.contentVariants[defaultVariant] && defaultVariant) ||
          Object.keys(payload.contentVariants)[0];
        if (!activeVariant) return null;

        // The reader receives this exact object as `ApiChapter` over HTTP today: the
        // route serializes the same fields via `bookOk`, and JSON erases the strict
        // server payload types (ToneKeyed, BookPackageExample, …) into the client's
        // loose `ApiChapter` mirror. In-process we skip the HTTP hop, so we assert
        // that identical boundary here (via `unknown`) rather than re-declaring the
        // mirror. The client adapter re-reads every field defensively.
        const responseChapter = {
          chapterId: payload.chapterId,
          number: payload.number,
          title: payload.title,
          readingTimeMinutes: payload.readingTimeMinutes,
          activeVariant,
          availableVariants: Object.keys(payload.contentVariants),
          content: payload.contentVariants[activeVariant as keyof typeof payload.contentVariants],
          contentVariants: payload.contentVariants,
          examples: payload.examples,
          implementationPlan: payload.implementationPlan,
          reviewCards: payload.reviewCards,
          keyTakeawayCard: payload.keyTakeawayCard,
          v21Extras: payload.v21Extras,
        } as unknown as ApiChapterResponse["chapter"];

        return {
          chapter: responseChapter,
          progress: {
            currentChapterNumber: progress.currentChapterNumber,
            unlockedThroughChapterNumber: progress.unlockedThroughChapterNumber,
            completedChapters: progress.completedChapters,
          },
        } satisfies ApiChapterResponse;
      },
    });
  } catch (error) {
    // Fail closed to "no hydration": a not-started (403 book_not_started),
    // locked (403 chapter_locked), missing book (404), or any infra/auth error
    // leaves the client's existing fetch + `/start` state machine in charge.
    if (!(error instanceof BookApiError)) {
      console.warn("[ws3_024_initial_chapter_hydration_skipped]", {
        bookId,
        chapterParam,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}
