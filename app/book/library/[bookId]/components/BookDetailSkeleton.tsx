/**
 * Loading skeleton that mirrors the real book-detail geometry (glass hero with
 * cover + info column, then a stack of chapter rows) so the layout doesn't jump
 * when content arrives. Tokens only, decorative (aria-hidden). Shared by the
 * route-level loading.tsx and the client hydration gate so cold load and
 * hydration show one consistent loading language.
 */

function Block({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded ${className}`}
      style={{ background: "var(--bg-elevated)", ...style }}
    />
  );
}

function ChapterRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-t border-(--cf-border) py-4 first:border-t-0">
      <div
        className="h-8 w-8 shrink-0 rounded-full"
        style={{ background: "var(--bg-elevated)" }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <Block className="h-4 w-1/2" />
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="block h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--bg-elevated)" }}
            />
          ))}
        </div>
      </div>
      <Block className="h-3 w-12 shrink-0" />
    </div>
  );
}

export function BookDetailSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="relative z-10 mx-auto w-full max-w-450 px-4 pb-28 pt-7 sm:px-6 sm:pt-8 md:pb-24 lg:px-10 xl:px-16"
      aria-hidden="true"
    >
      {/* Breadcrumb */}
      <Block className="mb-6 h-4 w-40" />

      {/* Hero */}
      <div className="cf-panel animate-pulse rounded-2xl p-6 sm:p-8 lg:rounded-3xl">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
          {/* Cover */}
          <div
            className="h-52 w-36 shrink-0 rounded-xl md:h-72 md:w-48"
            style={{ background: "var(--bg-elevated)" }}
          />
          {/* Info column */}
          <div className="flex w-full min-w-0 flex-1 flex-col items-center md:items-start">
            <Block className="h-8 w-2/3" />
            <Block className="mt-2 h-4 w-1/3" />
            <div className="mt-3 flex gap-2">
              <Block className="h-6 w-20 rounded-lg" />
              <Block className="h-6 w-16 rounded-lg" />
              <Block className="h-6 w-20 rounded-lg" />
            </div>
            <div className="mt-3 w-full max-w-prose space-y-2">
              <Block className="h-3.5 w-full" />
              <Block className="h-3.5 w-4/5" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Block className="h-12 w-44 rounded-xl" />
              <Block className="h-11 w-11 rounded-xl" />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Block className="h-4 w-56" />
            </div>
          </div>
        </div>
      </div>

      {/* Journey header */}
      <div className="mt-10 mb-4 flex items-center justify-between">
        <Block className="h-5 w-40" />
        <Block className="h-4 w-24" />
      </div>

      {/* Chapter rows */}
      <div className="animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <ChapterRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-screen loading state: app shell + a lightweight top-bar placeholder +
 * the body skeleton. Shared by the route-level loading.tsx (cold navigation)
 * and the client hydration gate so both render byte-identical markup — zero
 * layout shift between the two loading stages.
 */
export function BookDetailLoading() {
  return (
    <main className="cf-app-shell relative">
      <span className="sr-only" role="status">
        Loading book details…
      </span>
      <div
        className="cf-topbar sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10"
        aria-hidden="true"
      >
        <div className="h-7 w-28 rounded" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-9 w-9 rounded-full" style={{ background: "var(--bg-elevated)" }} />
      </div>
      <BookDetailSkeleton />
    </main>
  );
}
