// Pure decision seam for server-hydrated chapter content (WS3-024).
//
// The reader's server page (page.tsx) loads the entry chapter's CONTENT
// server-side and passes it to <ChapterReaderClient>, which forwards it to
// `useChapterContent`. This module holds the dependency-free decision the hook
// uses to choose between serving that hydrated payload and issuing its own
// network fetch — extracted so it can be unit-tested WITHOUT importing the
// client hook (which pulls in browser/`fetchBookJson` code that is unsafe to
// import under the node test runner). See useChapterContent.ts for the adapter
// (`buildChapterSeed`) that turns the payload into hook state.

import type {
  ApiChapterProgress,
  InitialChapterReaderSeed,
} from "@/app/book/library/[bookId]/chapter/[chapterId]/lib/chapterFromApi";

export type InitialReaderRoute = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
};

export type InitialReaderProgressFloor = {
  currentChapterId: string;
  completedChapterIds: string[];
  unlockedChapterIds: string[];
};

export type StartAccessFailure =
  | "paywall"
  | "email_verification"
  | "review"
  | "account_deleted"
  | "reauth"
  | "blocked"
  | "transient";

export type BookStartRequest<T> = {
  bookId: string;
  request: Promise<T>;
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

/**
 * Validate the authorization attestation against the published route before
 * any seed bytes can influence reader state. Reconstructed prose is validated
 * by the production chapter adapter before the caller treats this seed as
 * usable.
 */
export function isInitialReaderSeedForRoute(
  seed: InitialChapterReaderSeed | null | undefined,
  route: InitialReaderRoute,
): seed is InitialChapterReaderSeed {
  if (!seed) return false;
  const progress = seed.content?.progress as ApiChapterProgress | undefined;
  return (
    seed.schemaVersion === 1 &&
    seed.authorization === "active-entitled-started-unlocked" &&
    seed.onboardingCompleted === true &&
    seed.route?.bookId === route.bookId &&
    seed.route?.chapterId === route.chapterId &&
    seed.route?.chapterNumber === route.chapterNumber &&
    seed.content?.chapter?.number === route.chapterNumber &&
    isPositiveInteger(progress?.currentChapterNumber) &&
    isPositiveInteger(progress?.unlockedThroughChapterNumber) &&
    progress.unlockedThroughChapterNumber >= route.chapterNumber &&
    Array.isArray(progress.completedChapters) &&
    progress.completedChapters.every(isPositiveInteger)
  );
}

/** Map the server's numeric progress snapshot onto canonical manifest IDs. */
export function mapInitialReaderProgressToManifest(
  progress: ApiChapterProgress,
  chapters: ReadonlyArray<{ id: string; number: number }>,
  route: InitialReaderRoute,
): InitialReaderProgressFloor | null {
  const byNumber = new Map(chapters.map((chapter) => [chapter.number, chapter.id]));
  const currentChapterId = byNumber.get(progress.currentChapterNumber);
  const routeChapterId = byNumber.get(route.chapterNumber);
  if (!currentChapterId || routeChapterId !== route.chapterId) return null;

  const completedChapterIds = Array.from(
    new Set(
      progress.completedChapters
        .map((number) => byNumber.get(number))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const unlockedChapterIds = chapters
    .filter((chapter) => chapter.number <= progress.unlockedThroughChapterNumber)
    .map((chapter) => chapter.id);
  if (!unlockedChapterIds.includes(route.chapterId)) return null;

  return {
    currentChapterId,
    completedChapterIds,
    unlockedChapterIds: Array.from(
      new Set([...unlockedChapterIds, ...completedChapterIds, currentChapterId]),
    ),
  };
}

export function shouldRenderInitialReaderContent(params: {
  hasAttestedSeed: boolean;
  contentHydrated: boolean;
  hasChapter: boolean;
}): boolean {
  return params.hasAttestedSeed && params.contentHydrated && params.hasChapter;
}

export function shouldRetainApiChapterAfterFailure(params: {
  hasApiChapter: boolean;
  status: number | null;
}): boolean {
  return params.hasApiChapter && (params.status === null || params.status >= 500);
}

/** Classify `/start` failures without trusting message text. */
export function classifyStartAccessFailure(params: {
  status: number | null;
  code?: string;
}): StartAccessFailure {
  const { status, code } = params;
  if (code === "account_deleted") return "account_deleted";
  if (status === 401) return "reauth";
  if (code === "paywall_book_limit" || status === 402) return "paywall";
  if (code === "email_verification_required") return "email_verification";
  if (code === "free_access_review_required") return "review";
  if (status !== null && status >= 400 && status < 500) return "blocked";
  return "transient";
}

export function getOrCreateBookStartRequest<T>(params: {
  current: BookStartRequest<T> | null;
  bookId: string;
  create: () => Promise<T>;
}): { entry: BookStartRequest<T>; created: boolean } {
  if (params.current?.bookId === params.bookId) {
    return { entry: params.current, created: false };
  }
  return {
    entry: { bookId: params.bookId, request: params.create() },
    created: true,
  };
}

/** Stable key identifying one (chapter, refetch) request the hook can satisfy. */
export function buildChapterSeedKey(
  bookId: string,
  chapterNumber: number,
  refetchKey: number,
): string {
  return `${bookId}:${chapterNumber}:${refetchKey}`;
}

export type ChapterContentFetchDecision =
  // The server seed for this exact (chapter, refetch) has already been applied
  // (mount lazy-init or a prior navigation re-seed) — do nothing, no fetch.
  | "skip-served"
  // A usable server seed exists for this chapter and no refetch was requested —
  // apply it instead of fetching.
  | "serve-seed"
  // No usable seed (absent / different chapter / empty), or a refetch/retry was
  // requested — perform the normal network fetch.
  | "fetch";

/**
 * Decide how `useChapterContent` should source the current chapter.
 *
 * Behaviour-preserving guarantees:
 *  - When the server hydrated THIS chapter and `refetchKey === 0`, no network
 *    fetch fires (`serve-seed`, then `skip-served` on any idempotent re-run).
 *  - Any `refetchKey > 0` (the "Try again" / retry flow) always returns
 *    `fetch`, even when a seed exists, so retries hit the network.
 *  - A chapter with no usable seed (navigation to an un-hydrated chapter, a
 *    not-started / locked / logged-out viewer whose server load returned null)
 *    returns `fetch`, so the existing fetch + fallback path is untouched.
 */
export function decideChapterContentFetch(params: {
  hasUsableSeed: boolean;
  refetchKey: number;
  seedKey: string;
  servedSeedKey: string | null;
}): ChapterContentFetchDecision {
  if (params.servedSeedKey === params.seedKey) return "skip-served";
  if (params.refetchKey === 0 && params.hasUsableSeed) return "serve-seed";
  return "fetch";
}
