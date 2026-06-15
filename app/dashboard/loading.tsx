/**
 * Route-level streaming fallback for the gated dashboard shell. Renders
 * immediately on cold navigation (while the server auth round-trip in
 * page.tsx runs) so the viewport never blanks. Pure SERVER component —
 * no "use client", no hooks. Tokens only; decorative (aria-hidden) with a
 * single polite status line for screen readers.
 *
 * Exported as a named `DashboardShellSkeleton` too so the page-level
 * <Suspense> fallback can render byte-identical markup (no double-jump).
 */

function SkeletonBlock({
  width,
  height,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-(--cf-surface-muted) ${className}`}
      style={{ width: width ?? "100%", height: height ?? 20 }}
    />
  );
}

export function DashboardShellSkeleton() {
  return (
    <div
      className="cf-app-shell relative"
      style={{ background: "var(--cf-page-bg)" }}
    >
      <span className="sr-only" role="status">
        Loading your dashboard…
      </span>

      {/* Top bar placeholder (mirrors TopNav's height + logo/avatar slots) */}
      <div
        className="cf-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10"
        aria-hidden="true"
      >
        <div className="h-7 w-28 rounded bg-(--cf-surface-muted)" />
        <div className="h-9 w-9 rounded-full bg-(--cf-surface-muted)" />
      </div>

      {/* Body — same centered container as WorkspacePage's <main> */}
      <div
        className="mx-auto w-full px-4 py-5 md:px-8 md:py-7 lg:px-10 xl:px-16"
        style={{ maxWidth: 1800 }}
        aria-hidden="true"
      >
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <SkeletonBlock height={28} width="40%" />
            <SkeletonBlock height={16} width="55%" />
          </div>

          {/* Hero card */}
          <div className="rounded-2xl border border-(--cf-border-strong) bg-(--cf-surface-muted) p-6 md:p-8">
            <SkeletonBlock height={14} width={120} />
            <div className="mt-4">
              <SkeletonBlock height={36} width="50%" />
            </div>
            <div className="mt-2">
              <SkeletonBlock height={16} width="30%" />
            </div>
            <div className="mt-6">
              <SkeletonBlock height={48} width={220} />
            </div>
          </div>

          {/* Weekly strip */}
          <div className="flex gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonBlock key={i} height={32} width={32} className="rounded-lg" />
            ))}
          </div>

          {/* Book row */}
          <div>
            <SkeletonBlock height={24} width="20%" className="mb-4" />
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} height={200} width={160} className="shrink-0" />
              ))}
            </div>
          </div>

          {/* Rewards / progress */}
          <div className="flex flex-col gap-4 md:flex-row">
            <SkeletonBlock height={140} className="flex-1 rounded-2xl" />
            <SkeletonBlock height={140} className="flex-1 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return <DashboardShellSkeleton />;
}
