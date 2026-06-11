"use client";

/**
 * Loading skeleton that mirrors the final library geometry (glass hero + a
 * 2:3-aspect card grid) instead of a bare "Loading…" card, so the layout
 * doesn't jump when real data arrives. Tokens only; decorative (aria-hidden).
 */
export function LibrarySkeleton() {
  return (
    <div className="px-5 pb-24 pt-6 md:px-7" aria-hidden="true">
      {/* Hero */}
      <div
        className="mx-auto animate-pulse overflow-hidden rounded-2xl"
        style={{
          maxWidth: 1080,
          background: "var(--bg-glass)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex flex-col gap-8 p-8 md:flex-row md:items-center md:gap-12">
          <div
            className="shrink-0 self-center md:self-auto"
            style={{
              width: 200,
              height: 300,
              borderRadius: "var(--radius-lg-val)",
              background: "var(--bg-elevated)",
            }}
          />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-32 rounded" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-7 w-2/3 rounded" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-4 w-1/3 rounded" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-4 w-3/4 rounded" style={{ background: "var(--bg-elevated)" }} />
            <div className="h-12 w-48 rounded-xl" style={{ background: "var(--bg-elevated)" }} />
          </div>
        </div>
      </div>

      {/* Card rows */}
      <div className="mx-auto mt-12" style={{ maxWidth: 1080 }}>
        <div className="h-5 w-48 animate-pulse rounded" style={{ background: "var(--bg-elevated)" }} />
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div
                className="w-full"
                style={{
                  aspectRatio: "2/3",
                  borderRadius: "var(--radius-md-val)",
                  background: "var(--bg-elevated)",
                }}
              />
              <div className="mt-2.5 h-4 w-3/4 rounded" style={{ background: "var(--bg-elevated)" }} />
              <div className="mt-1.5 h-3 w-1/2 rounded" style={{ background: "var(--bg-elevated)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
