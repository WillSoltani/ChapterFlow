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

/** Stable key identifying one (chapter, refetch) request the hook can satisfy. */
export function buildChapterSeedKey(
  chapterNumber: number,
  refetchKey: number,
): string {
  return `${chapterNumber}:${refetchKey}`;
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
