/**
 * Shared route-level loading fallback (SHELL-11). Rendered by `loading.tsx`
 * files so a nav tap shows the page frame at once while the server checks the
 * session, instead of leaving the old page on screen. Server-safe: no
 * "use client", no hooks. Geometry follows the existing per-route skeletons
 * (app/book/progress/loading.tsx): a 64px `cf-topbar` slot, then a heading and
 * a grid of card blocks.
 */

type RouteSkeletonProps = {
  /** Screen-reader status, e.g. "Loading your achievements…". */
  label: string;
  /** Draw the top-bar placeholder. Off for routes without the app header. */
  showNav?: boolean;
};

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-(--cf-surface-muted) ${className}`} />;
}

export function RouteSkeleton({ label, showNav = true }: RouteSkeletonProps) {
  return (
    <div className="cf-app-shell">
      <span className="sr-only" role="status">
        {label}
      </span>

      {showNav ? (
        <div
          className="cf-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10"
          aria-hidden="true"
        >
          <div className="h-7 w-28 rounded bg-(--cf-surface-muted)" />
          <div className="h-9 w-9 rounded-full bg-(--cf-surface-muted)" />
        </div>
      ) : null}

      <main
        className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24"
        aria-hidden="true"
      >
        <Block className="h-8 w-56 rounded-lg" />
        <Block className="mt-3 h-4 w-80 max-w-full rounded" />

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Block key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
