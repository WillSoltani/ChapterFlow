import { LibrarySkeleton } from "@/components/library/LibrarySkeleton";

/**
 * Route-level streaming fallback for the gated library shell. Streams a
 * skeleton immediately on cold navigation (while the server auth round-trip
 * in page.tsx runs) so the viewport never blanks. Pure SERVER component — no
 * "use client", no hooks. Mirrors LibraryPage's geometry (full-height shell +
 * a top-bar slot + the shared LibrarySkeleton) so there's no jump when the
 * client mounts and renders the same skeleton during hydration.
 */
export default function LibraryLoading() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg-base)" }}
    >
      <span className="sr-only" role="status">
        Loading your library…
      </span>

      {/* Top-bar placeholder (mirrors TopNav's height + logo/avatar slots) */}
      <div
        className="cf-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10"
        aria-hidden="true"
      >
        <div className="h-7 w-28 rounded bg-(--cf-surface-muted)" />
        <div className="h-9 w-9 rounded-full bg-(--cf-surface-muted)" />
      </div>

      <LibrarySkeleton />
    </main>
  );
}
