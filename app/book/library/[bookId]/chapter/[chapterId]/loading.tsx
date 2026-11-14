import { ChapterSkeleton } from "@/app/book/library/[bookId]/chapter/[chapterId]/components/ChapterSkeleton";

/**
 * Route-level streaming fallback for the reader. Renders the SAME geometry as
 * the in-app hydration gate (ReaderAccessState: <main> + ChapterSkeleton)
 * instead of a centered "Loading…" line, so the cold-load skeleton and the
 * client mount match — no double-jump / CLS when the client takes over.
 * Server component; the imported skeleton is "use client" but renders fine
 * from here.
 */
export default function ChapterLoading() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-(--cr-bg-root)">
      <ChapterSkeleton />
    </main>
  );
}
