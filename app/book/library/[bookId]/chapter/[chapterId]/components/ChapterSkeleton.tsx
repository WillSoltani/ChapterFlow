"use client";

// Same geometry as the reader (ReaderTopBar + ReaderChrome's column at the
// default Narrow width), so the hand-off to the real page does not jump.
export function ChapterSkeleton() {
  return (
    <div className="w-full" role="status" aria-busy="true" aria-label="Loading chapter">
      {/* Top bar placeholder: Back, step control, four icon buttons */}
      <div className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-(--cr-glass-border) bg-(--cr-bg-root) px-1 sm:h-[52px] sm:px-4">
        <div className="flex h-11 w-11 items-center justify-center">
          <div className="h-[18px] w-[18px] rounded bg-(--cr-bg-surface-2)" />
        </div>
        <div className="h-4 w-28 rounded-full bg-(--cr-bg-surface-2)" />
        <div className="flex items-center">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-11 w-11 items-center justify-center">
              <div className="h-[18px] w-[18px] rounded bg-(--cr-bg-surface-2)" />
            </div>
          ))}
        </div>
      </div>

      <div
        className="mx-auto w-full motion-safe:animate-pulse px-5 sm:px-8"
        style={{ maxWidth: "calc(var(--reading-font-size, 18px) * 29 + 4rem)" }}
      >
        {/* Title block */}
        <div className="pb-7 pt-6 sm:pb-10 sm:pt-14">
          <div className="h-3 w-20 rounded-full bg-(--cr-bg-surface-3)" />
          <div className="mt-3 h-8 w-4/5 rounded-lg bg-(--cr-bg-surface-2) sm:h-10" />
          <div className="mt-3 h-3 w-48 rounded-full bg-(--cr-bg-surface-3)" />
        </div>

        {/* Text lines */}
        <div className="space-y-3">
          {["w-full", "w-11/12", "w-full", "w-10/12", "w-full", "w-9/12"].map((width, i) => (
            <div key={i} className={`h-4 rounded bg-(--cr-bg-surface-3) ${width}`} />
          ))}
          <div className="pt-4" />
          {["w-full", "w-11/12", "w-8/12"].map((width, i) => (
            <div key={i} className={`h-4 rounded bg-(--cr-bg-surface-3) ${width}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
