"use client";

/**
 * RecallLibrary — STEP 4 · § "The library" (the real catalog).
 *
 * A restrained, premium showcase of REAL book covers over the same deep canvas,
 * staged as a SCROLL-PINNED beat. The section is intentionally tall (rl-lib-pin);
 * an inner sticky stage (rl-lib-stage) holds in view while a single scroll
 * handler choreographs the moment:
 *   1. the oversized headline settles down to its resting scale,
 *   2. the coverflow zooms up into place from below,
 *   3. continued scroll steps the active cover index across a few titles, and
 *   4. a thin progress bar tracks the browse.
 *
 * ONE idea (these are real books, not a mockup), ONE focal element (the coverflow
 * of actual covers), lots of air, exactly one accent (the periwinkle recall
 * accent on the derived count + the progress fill). No chart/curve (that lives in
 * the hero and appears exactly once). The book count is DERIVED from the live
 * catalog via CATALOG_BOOK_COUNT_DISPLAY so it can never overstate.
 *
 * The active-cover index is LIFTED here and pushed into RecallCoverflow as a
 * controlled prop, so the scroll handler is the sole index driver. The coverflow
 * is only ever on-screen WHILE it is pinned and scroll-driven, so its own
 * auto-advance would only fire off-screen (jumping the index before you arrive)
 * and would fight the scroll — it is therefore suppressed here (paused), and the
 * coverflow's autoplay/hover-pause only matter in its standalone uncontrolled use.
 *
 * prefers-reduced-motion (OS media query OR the in-app html[data-motion="reduced"]
 * toggle, RECALL's single source of truth) → NO pin: the section collapses to its
 * natural height, the stage is static, and the choreography snaps to its final
 * state (apply(1)) so everything reads at rest with zero motion.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { getBookById } from "@/app/book/data/booksCatalog";
import { getBookCoverPath } from "@/lib/book-covers";
import { CATALOG_BOOK_COUNT_DISPLAY } from "@/lib/catalog-stats";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { RecallCoverflow } from "./RecallCoverflow";
import { RecallLibraryBrowser } from "./RecallLibraryBrowser";

/**
 * A small, deliberately restrained selection of recognizable titles for the
 * showcase row — chosen for breadth (habits, decision-making, focus, money,
 * meaning, strategy, mindset). Each id is a real catalog book with a committed
 * cover raster; titles/authors for alt text are read from the live catalog so
 * they can never drift from the real data. The full count is stated separately
 * from CATALOG_BOOK_COUNT_DISPLAY — this row is a sample, not the whole shelf.
 */
const SHOWCASE_BOOK_IDS = [
  "atomic-habits",
  "thinking-fast-and-slow",
  "deep-work",
  "the-psychology-of-money",
  "mans-search-for-meaning",
  "zero-to-one",
  "mindset",
  "grit",
  "the-power-of-habit",
  "never-split-the-difference",
] as const;

const SHOWCASE_BOOKS = SHOWCASE_BOOK_IDS.map((id) => {
  const book = getBookById(id);
  return {
    id,
    title: book?.title ?? id,
    author: book?.author ?? "",
    src: getBookCoverPath(id),
  };
});

/** How many covers the scroll-steps walk across before the pin releases. */
const BROWSE_STEPS = 4;

export function RecallLibrary() {
  const count = SHOWCASE_BOOKS.length;

  // ── Lifted state: the scroll handler drives the focused index (the coverflow
  //    is a controlled child here). Autoplay is suppressed in this pinned layout
  //    (see the header), so there is no pause state to track. ──────────────────
  const [active, setActive] = useState(0);
  // The full-catalog browser overlay (portaled via Dialog) toggles from here.
  const [browserOpen, setBrowserOpen] = useState(false);

  // Wrap any incoming index into range so the carousel loops in both directions.
  const focus = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActive(((index % count) + count) % count);
    },
    [count],
  );

  // Honor BOTH reduced-motion signals (OS query + in-app data-motion toggle),
  // reactively — the effect re-runs when this flips so a live toggle takes hold.
  const reduced = usePrefersReducedMotion();

  const secRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const tintRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);
  // Track the last scroll-derived index so we only call setState on an actual
  // change (the scroll handler runs every frame).
  const lastIdxRef = useRef(0);

  // ── Scroll choreography. transform/opacity ONLY (compositor-safe), driven off
  //    a single rAF-throttled scroll listener reading the section's progress p. ─
  useEffect(() => {
    const sec = secRef.current;
    const stage = stageRef.current;
    const head = headRef.current;
    const cover = coverRef.current;
    if (!sec || !stage) return;

    if (head) head.style.transformOrigin = "center top";
    if (cover) cover.style.transformOrigin = "center top";

    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

    // Map section scroll progress p∈[0,1] onto every animated property.
    const apply = (p: number) => {
      // The headline arrives oversized + bold, then settles fast.
      const a = easeOut(Math.min(1, p / 0.18));
      const headScale = 1.62 - 0.62 * a;
      if (head) {
        head.style.transform = `translateY(${(1 - a) * -8}px) scale(${headScale})`;
        head.style.opacity = String(Math.min(1, p / 0.06));
      }

      // The coverflow zooms up into place from below.
      const b = easeOut(Math.min(1, Math.max(0, (p - 0.1) / 0.22)));
      const coverScale = 0.62 + 0.38 * b;
      const coverOpacity = Math.min(1, Math.max(0, (p - 0.1) / 0.14));
      if (cover) {
        cover.style.transform = `translateY(${(1 - b) * 64}px) scale(${coverScale})`;
        cover.style.opacity = String(coverOpacity);
      }

      // The section backdrop lifts ever so slightly.
      const tint = tintRef.current;
      if (tint) tint.style.opacity = String(Math.min(0.7, p / 0.3));

      // Scroll-driven browsing: step through a few covers before the pin releases.
      const browse = Math.min(1, Math.max(0, (p - 0.36) / 0.56));
      const idx = Math.round(browse * BROWSE_STEPS);
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        focus(idx);
      }
      const bar = barRef.current;
      if (bar) {
        bar.style.transform = `scaleX(${browse.toFixed(3)})`;
        const track = bar.parentElement;
        if (track) track.style.opacity = String(coverOpacity);
      }
    };

    // ── Reduced motion: drop the pin (natural height), make the stage static, and
    //    snap the choreography to its final, fully-arrived state. No listeners. ──
    if (reduced) {
      sec.style.minHeight = "auto";
      stage.style.position = "static";
      stage.style.minHeight = "0";
      apply(1);
      return;
    }

    // Restore the CSS-defined pin (340vh tall + sticky stage) in case a live
    // data-motion toggle flipped us back from the reduced branch above, which had
    // overridden these inline.
    sec.style.minHeight = "";
    stage.style.position = "";
    stage.style.minHeight = "";

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = sec.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const total = rect.height - vh;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
        apply(p);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [focus, reduced]);

  return (
    <section
      ref={secRef}
      id="library"
      aria-labelledby="recall-library-headline"
      className="rl-lib-pin relative w-full"
      style={{ background: "transparent" }}
    >
      {/* ── The sticky stage holds in view while the scroll handler choreographs. ── */}
      <div ref={stageRef} className="rl-lib-stage">
        <div ref={tintRef} className="rl-lib-tint" aria-hidden />

        <div className="mx-auto w-full max-w-[78rem]">
          {/* ── Editorial header, centered, lots of air. Settles from oversized via
              the scroll handler (transform-origin center top). ── */}
          <header
            ref={headRef}
            className="rl-lib-header mx-auto max-w-[42rem] text-center"
          >
            <p
              className="font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.34em]"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              The library
            </p>
            <h2
              id="recall-library-headline"
              className="mt-6 font-(family-name:--font-display) font-bold leading-[0.98] tracking-[-0.04em] text-balance"
              style={{
                color: "var(--cf-recall-ink)",
                fontSize: "clamp(2.25rem, 4.4vw, 3.75rem)",
              }}
            >
              <span style={{ color: "var(--cf-recall-accent)" }}>
                {CATALOG_BOOK_COUNT_DISPLAY}
              </span>{" "}
              books, all real.
            </h2>
            <p
              className="mx-auto mt-6 max-w-[40ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              The non-fiction that has been sitting half-read on your shelf, each
              one rebuilt into the loop. Pick a cover and finally make it stick.
            </p>
          </header>

          {/* ── The 3D coverflow: zooms up into place, then scroll-steps. The
              active index is driven from here (controlled); autoplay is held
              paused — the scroll is the sole index driver in this pinned beat. ── */}
          <div ref={coverRef} className="rl-cf-wrap">
            <RecallCoverflow
              books={[...SHOWCASE_BOOKS]}
              active={active}
              onActiveChange={focus}
              paused
            />
          </div>

          {/* ── Scroll-browse progress bar, fades in with the covers. ── */}
          <div className="rl-lib-progress">
            <span ref={barRef} className="rl-lib-progress-fill" />
          </div>

          {/* ── Actions: open the full catalog, or jump to the request form. ── */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <button
              type="button"
              onClick={() => setBrowserOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,background,border-color] duration-150 ease-out hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                color: "var(--cf-recall-ink)",
                border: "1px solid var(--cf-recall-border-strong)",
                // @ts-expect-error -- CSS custom property for the focus ring color
                "--tw-ring-color": "var(--cf-recall-accent-line)",
              }}
            >
              <LayoutGrid size={17} strokeWidth={2} aria-hidden />
              Browse all {CATALOG_BOOK_COUNT_DISPLAY} books
            </button>
            <a
              href="#request"
              className="rounded text-[0.9375rem] font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                color: "var(--cf-recall-ink-soft)",
                // @ts-expect-error -- CSS custom property for the focus ring color
                "--tw-ring-color": "var(--cf-recall-accent-line)",
              }}
            >
              Request a book
            </a>
          </div>
        </div>
      </div>

      {/* Full-catalog browser overlay (portaled; placement here is just ownership). */}
      <RecallLibraryBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </section>
  );
}
