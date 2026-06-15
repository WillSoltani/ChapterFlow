import { ChapterSkeleton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterSkeleton";
import { ChapterBackgroundOrbs } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterBackgroundOrbs";

/**
 * Route-level streaming fallback for the reader. Renders the SAME geometry as
 * the in-app hydration gate (ChapterReaderClient: <main> + background orbs +
 * ChapterSkeleton) instead of a centered "Loading…" line, so the cold-load
 * skeleton and the client mount are byte-identical — no double-jump / CLS when
 * the client takes over. Server component; the imported skeleton/orbs are
 * "use client" but render fine from here.
 */
export default function ChapterLoading() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <ChapterBackgroundOrbs />
      <ChapterSkeleton />
    </main>
  );
}
