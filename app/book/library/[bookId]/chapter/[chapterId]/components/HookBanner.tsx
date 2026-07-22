"use client";

import { useEffect, useState } from "react";

type HookBannerProps = {
  hook: string;
  counterintuition?: string | undefined;
  /** When true, show the full hook + counterintuition. When false, show a
   *  compact variant (just the hook line, smaller padding). The reader-page
   *  hook is the chapter's first impression; once they scroll into the
   *  chapter, the banner shrinks so it stops eating viewport. */
  collapsed?: boolean | undefined;
};

/** Auto-collapsing variant. Pass `autoCollapse` to make the banner shrink
 *  itself once the user scrolls past about one viewport height. */
type AutoCollapsingHookBannerProps = Omit<HookBannerProps, "collapsed"> & {
  autoCollapse?: boolean;
};

export function HookBanner({ hook, counterintuition, collapsed }: HookBannerProps) {
  if (collapsed) {
    return (
      <div className="cr-hook-banner mb-3 rounded-xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-4 py-2.5">
        <p className="line-clamp-1 text-sm font-semibold leading-snug text-(--cr-accent)">
          {hook}
        </p>
      </div>
    );
  }

  return (
    <div className="cr-hook-banner mb-4 rounded-2xl border border-(--cr-glass-border-teal) bg-(--cr-accent-muted) px-5 py-4">
      <p className="text-base font-semibold leading-snug text-(--cr-accent) sm:text-lg">
        {hook}
      </p>
      {counterintuition ? (
        <p className="mt-2 text-sm leading-relaxed text-(--cr-text-secondary)">
          {counterintuition}
        </p>
      ) : null}
    </div>
  );
}

/** Drop-in wrapper that listens to scroll and switches `collapsed` once the
 *  reader has scrolled past ~120vh worth of content. Resets on tab change
 *  (handled by parent re-key, not by this component). */
export function AutoCollapsingHookBanner({ hook, counterintuition, autoCollapse = true }: AutoCollapsingHookBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!autoCollapse) return;
    const onScroll = () => {
      setCollapsed(window.scrollY > Math.min(480, window.innerHeight * 0.6));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoCollapse]);

  return (
    <div className={collapsed ? "sticky top-0 z-30 -mx-5 px-5 backdrop-blur-md sm:-mx-8 sm:px-8" : ""}>
      <HookBanner hook={hook} counterintuition={counterintuition} collapsed={collapsed} />
    </div>
  );
}
