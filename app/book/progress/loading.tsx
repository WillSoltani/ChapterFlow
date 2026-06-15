/**
 * Route-level streaming fallback for the gated progress shell. Streams a
 * skeleton immediately on cold navigation (while the server auth round-trip
 * in page.tsx runs) so the viewport never blanks. Pure SERVER component — no
 * "use client", no hooks. Mirrors ProgressPage's geometry (cf-app-shell +
 * top-bar slot + max-w-7xl main) with a hero / quests / stat-card stack so
 * there's no jump when the client mounts and renders its own skeleton.
 */

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-(--cf-surface-muted) ${className}`} />;
}

export default function ProgressLoading() {
  return (
    <div className="cf-app-shell">
      <span className="sr-only" role="status">
        Loading your progress…
      </span>

      {/* Top-bar placeholder (mirrors TopNav's height + logo/avatar slots) */}
      <div
        className="cf-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10"
        aria-hidden="true"
      >
        <div className="h-7 w-28 rounded bg-(--cf-surface-muted)" />
        <div className="h-9 w-9 rounded-full bg-(--cf-surface-muted)" />
      </div>

      <main
        className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24"
        aria-hidden="true"
      >
        {/* Hero / level card */}
        <Block className="h-44 w-full rounded-3xl" />

        {/* Daily quests row */}
        <div className="mt-8 flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Block key={i} className="h-28 flex-1 rounded-2xl" />
          ))}
        </div>

        {/* Weekly summary + activity stat cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Block className="h-56 rounded-2xl" />
          <Block className="h-56 rounded-2xl" />
        </div>

        {/* Your books shelf */}
        <div className="mt-8">
          <Block className="mb-4 h-6 w-40 rounded" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Block key={i} className="h-48 w-32 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
