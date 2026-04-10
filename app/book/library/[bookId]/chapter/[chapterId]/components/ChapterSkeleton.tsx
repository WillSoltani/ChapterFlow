"use client";

export function ChapterSkeleton() {
  return (
    <div
      className="animate-pulse w-full px-5 pt-3 sm:px-8 sm:pt-3"
      role="status"
      aria-busy="true"
      aria-label="Loading chapter"
    >
      {/* Sticky header placeholder: back button + settings icons */}
      <div className="flex items-center justify-between py-3">
        <div className="h-4 w-16 rounded-full bg-(--cr-bg-surface-2)" />
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 rounded-full bg-(--cr-bg-surface-2)" />
          <div className="h-8 w-8 rounded-full bg-(--cr-bg-surface-2)" />
          <div className="h-8 w-8 rounded-full bg-(--cr-bg-surface-2)" />
        </div>
      </div>
      {/* Scroll progress strip */}
      <div className="h-0.5 w-full bg-(--cr-bg-surface-3)" />

      {/* Title block */}
      <div className="pt-6 pb-2 sm:pt-8 space-y-3">
        <div className="h-3 w-40 rounded-full bg-(--cr-bg-surface-3)" />
        <div className="h-9 w-4/5 rounded-lg bg-(--cr-bg-surface-2)" />
        <div className="h-3 w-48 rounded-full bg-(--cr-bg-surface-3)" />
      </div>

      {/* Phase stepper placeholder */}
      <div className="mt-6">
        <div className="flex items-center justify-center gap-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center">
              <div className="h-9 w-9 rounded-full bg-(--cr-bg-surface-2)" />
              {i < 2 && <div className="h-0.5 w-20 bg-(--cr-bg-surface-3)" />}
            </div>
          ))}
        </div>
        <div className="mt-3 h-[3px] w-full rounded-full bg-(--cr-bg-surface-3)" />
      </div>

      {/* Main content card */}
      <div className="mt-8">
        <div className="rounded-3xl p-8 bg-(--cr-bg-surface-2) space-y-4">
          <div className="h-4 w-full rounded bg-(--cr-bg-surface-3)" />
          <div className="h-4 w-11/12 rounded bg-(--cr-bg-surface-3)" />
          <div className="h-4 w-9/12 rounded bg-(--cr-bg-surface-3)" />
          <div className="pt-4 space-y-3">
            <div className="h-6 w-3/4 rounded-full bg-(--cr-bg-surface-3)" />
            <div className="h-6 w-2/3 rounded-full bg-(--cr-bg-surface-3)" />
            <div className="h-6 w-3/5 rounded-full bg-(--cr-bg-surface-3)" />
          </div>
        </div>
      </div>
    </div>
  );
}
