"use client";

/**
 * RecallCoverflow — a premium CSS-3D coverflow of REAL book covers.
 *
 * The library section's focal element: a perspective "shelf" where one cover
 * stands upright and lit at center while its neighbors angle back into depth
 * (rotateY ±, scaled + dimmed by distance). One cover is the subject; the rest
 * recede — the same Apple-product-shot restraint as the rest of RECALL (deep
 * canvas, ONE periwinkle accent on the focused frame + arrows, lots of air).
 *
 * Motion is compositor-safe ONLY — every animated property is transform/opacity
 * (the per-cover transition runs on transform+opacity, ~400ms ease), so it stays
 * off the main thread. A slow auto-advance (~3.5s) loops the carousel and PAUSES
 * on hover / focus / pointer-down. Keyboard ArrowLeft/Right step the shelf when
 * it (or a cover) is focused.
 *
 * prefers-reduced-motion (OS media query OR the in-app html[data-motion="reduced"]
 * toggle, which is RECALL's single source of truth) → a STATIC centered row of
 * three covers, NO auto-advance, NO 3D transitions, NO entrance.
 *
 * Covers are real local rasters via next/image (fill, fixed aspect-[2/3] →
 * CLS 0). Token-only color throughout — the frame/glow/dim are all recall tokens.
 */

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** A typed style bag so we can pass Tailwind ring CSS custom-properties through
 *  inline `style` without `any` or scattered `@ts-expect-error` directives. */
type RingStyle = CSSProperties & {
  "--tw-ring-color"?: string;
  "--tw-ring-offset-color"?: string;
};

/** The cover data the shelf renders. Matches RecallLibrary's SHOWCASE_BOOKS row
 *  shape exactly (id + title/author for labels + a resolved cover `src`). */
export type CoverflowBook = {
  id: string;
  title: string;
  author: string;
  src: string;
};

/**
 * The coverflow can run UNCONTROLLED (its own active-index + autoplay + pause,
 * the standalone default) OR CONTROLLED by a parent. The pinned RecallLibrary
 * drives both the active cover (scroll-stepped) and the paused flag (autoplay
 * suspended while the section is pinned mid-scroll), so it passes `active`,
 * `onActiveChange`, `paused`, and `onPausedChange`. When a value is provided the
 * matching internal state is bypassed; when it's omitted the shelf falls back to
 * its own state, so the component still works on its own.
 */
type CoverflowProps = {
  books: CoverflowBook[];
  /** Controlled focused-cover index. Omit for self-managed (uncontrolled). */
  active?: number;
  /** Called when the shelf wants to change focus (click / arrows / autoplay). */
  onActiveChange?: (index: number) => void;
  /** Controlled autoplay-pause flag. Omit for self-managed hover/focus pausing. */
  paused?: boolean;
  /** Called on hover/focus/press enter+leave so the parent can pause autoplay. */
  onPausedChange?: (paused: boolean) => void;
};

/** How many covers deep on each side of center we actually render in 3D. Covers
 *  further than this collapse to the back plane (kept mounted for a clean loop,
 *  but pushed off-stage + fully dimmed so only ~5 read as "the shelf"). */
const VISIBLE_PER_SIDE = 2;

/** Auto-advance cadence. Slow + calm, never frantic. */
const AUTOPLAY_MS = 3500;

/** Per-step geometry. Tuned so the center cover reads upright + forward and the
 *  immediate neighbors angle convincingly back without overlapping illegibly. */
const STEP_ROTATE_DEG = 42; // rotateY per side
const STEP_TRANSLATE_X = 56; // % of a cover width, per step out from center
const STEP_TRANSLATE_Z = 130; // px pushed back, per step
const STEP_SCALE = 0.12; // scale lost per step
const STEP_OPACITY = 0.34; // opacity lost per step

/**
 * Detects "reduce motion" from BOTH signals RECALL honors: the OS-level
 * `prefers-reduced-motion` media query AND the in-app `html[data-motion="reduced"]`
 * toggle (set by applyDocumentTheme). Returns false on the server / first paint
 * so SSR markup is stable, then resolves on mount and stays live via listeners.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;

    const compute = () =>
      setReduced(
        mql.matches || root.getAttribute("data-motion") === "reduced",
      );

    compute();
    mql.addEventListener("change", compute);

    // Watch the in-app toggle (the single source of truth) for live changes.
    const observer = new MutationObserver(compute);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });

    return () => {
      mql.removeEventListener("change", compute);
      observer.disconnect();
    };
  }, []);

  return reduced;
}

export function RecallCoverflow({
  books,
  active: activeProp,
  onActiveChange,
  paused: pausedProp,
  onPausedChange,
}: CoverflowProps) {
  const reduced = useReducedMotion();
  const count = books.length;

  // Internal fallbacks for the uncontrolled (standalone) case. When the matching
  // prop is supplied the parent owns the value and these are ignored.
  const [activeInternal, setActiveInternal] = useState(0);
  const [pausedInternal, setPausedInternal] = useState(false);

  const active =
    activeProp !== undefined
      ? // Defensively wrap a controlled index so an out-of-range parent value
        // (e.g. a scroll step past the end) still maps to a real cover.
        count === 0
        ? 0
        : ((activeProp % count) + count) % count
      : activeInternal;
  const paused = pausedProp !== undefined ? pausedProp : pausedInternal;

  // Route a pause request to the parent when controlled, else to local state.
  const setPaused = useCallback(
    (value: boolean) => {
      if (onPausedChange) onPausedChange(value);
      else setPausedInternal(value);
    },
    [onPausedChange],
  );

  const focus = useCallback(
    (index: number) => {
      if (count === 0) return;
      // Wrap into range so the carousel loops infinitely in both directions.
      const wrapped = ((index % count) + count) % count;
      // Route the focus change to the parent when controlled, else to local state.
      if (onActiveChange) onActiveChange(wrapped);
      else setActiveInternal(wrapped);
    },
    [count, onActiveChange],
  );

  const next = useCallback(() => focus(active + 1), [active, focus]);
  const prev = useCallback(() => focus(active - 1), [active, focus]);

  // ── Auto-advance: loops forever, suspended while paused or reduced-motion ──
  useEffect(() => {
    if (reduced || paused || count <= 1) return;
    const id = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduced, paused, count, next]);

  // ── Keyboard: ArrowLeft/Right step the shelf when it (or a cover) is focused ─
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    },
    [next, prev],
  );

  if (count === 0) return null;

  const focused = books[active];

  // Typed style bag — the variable annotation lets the ring custom-properties
  // pass through inline `style` without an excess-property error or `any`.
  const stageStyle: RingStyle = {
    perspective: "1400px",
    perspectiveOrigin: "50% 42%",
    "--tw-ring-color": "var(--cf-recall-accent-line)",
    "--tw-ring-offset-color": "transparent",
  };

  // ── Reduced-motion: a calm, static centered row of (up to) three covers, no
  //    3D, no auto-advance, no entrance. Center the active cover with one
  //    neighbor each side so the section never renders empty. ──────────────────
  if (reduced) {
    const staticBooks = pickStaticRow(books, active);
    return (
      <div className="mx-auto w-full max-w-[56rem]">
        <ul
          className="flex items-start justify-center gap-6 sm:gap-8"
          aria-label="A sample of the ChapterFlow catalog"
        >
          {staticBooks.map((book, i) => (
            <li
              key={book.id}
              className="aspect-[2/3] w-[40%] max-w-[14rem] sm:w-[30%]"
              // Visually emphasize the middle cover without any motion.
              style={{ opacity: i === 1 ? 1 : 0.55 }}
            >
              <CoverFrame book={book} focused={i === 1} />
            </li>
          ))}
        </ul>
        <CaptionPlate title={focused.title} author={focused.author} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[64rem]">
      {/* ── The 3D stage. perspective lives on the container; each cover is
           transformed in that shared space (transform-style: preserve-3d). ── */}
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured book covers. Use the arrows or arrow keys to browse"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        // Touch/pen have no hover, so pause only for the duration of the press and
        // resume on release — otherwise a single tap would freeze autoplay forever
        // (there is no pointer-leave to clear it). Mouse is governed by the
        // hover/focus handlers above, so skip it here to avoid double-toggling.
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") setPaused(true);
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") setPaused(false);
        }}
        onPointerCancel={(e) => {
          if (e.pointerType !== "mouse") setPaused(false);
        }}
        className="relative mx-auto h-[clamp(20rem,42vw,28rem)] w-full select-none rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
        style={stageStyle}
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {books.map((book, i) => {
            // Signed shortest offset from the active cover, wrapped so the loop
            // is symmetric (e.g. last → first reads as +1, not -(count-1)).
            let offset = i - active;
            if (offset > count / 2) offset -= count;
            if (offset < -count / 2) offset += count;

            const distance = Math.abs(offset);
            const isFocused = offset === 0;
            const beyond = distance > VISIBLE_PER_SIDE;

            // Covers past the visible window collapse to the back plane: pushed
            // fully out + transparent so only the near five read as the shelf.
            const dir = Math.sign(offset);
            // Neighbors angle back toward the depth on their own side; the
            // focused cover sits flat (upright, facing the viewer).
            const rotateY = isFocused ? 0 : -dir * STEP_ROTATE_DEG;
            const translateX = offset * STEP_TRANSLATE_X;
            const translateZ = beyond
              ? -STEP_TRANSLATE_Z * (VISIBLE_PER_SIDE + 1)
              : -distance * STEP_TRANSLATE_Z;
            const scale = beyond
              ? 1 - STEP_SCALE * (VISIBLE_PER_SIDE + 1)
              : 1 - distance * STEP_SCALE;
            const opacity = beyond
              ? 0
              : Math.max(0, 1 - distance * STEP_OPACITY);

            // Per-cover transform — compositor-safe: ONLY transform + opacity
            // animate. Typed bag so the ring custom-property type-checks.
            const coverStyle: RingStyle = {
              transform: `translate(-50%, -50%) translateX(${translateX}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
              opacity,
              zIndex: 100 - distance,
              transformStyle: "preserve-3d",
              transition:
                "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease",
              pointerEvents: beyond ? "none" : "auto",
              cursor: isFocused ? "default" : "pointer",
              "--tw-ring-color": "var(--cf-recall-accent)",
            };

            return (
              <button
                key={book.id}
                type="button"
                aria-label={
                  isFocused
                    ? `${book.title}${book.author ? ` by ${book.author}` : ""} (focused)`
                    : `Focus ${book.title}${book.author ? ` by ${book.author}` : ""}`
                }
                aria-current={isFocused ? "true" : undefined}
                aria-hidden={beyond ? true : undefined}
                tabIndex={beyond ? -1 : 0}
                onClick={() => focus(i)}
                className="absolute left-1/2 top-1/2 aspect-[2/3] h-[clamp(16rem,34vw,23rem)] -translate-x-1/2 -translate-y-1/2 rounded-[12px] focus-visible:outline-none focus-visible:ring-2"
                style={coverStyle}
              >
                <CoverFrame book={book} focused={isFocused} withReflection />
              </button>
            );
          })}
        </div>

        {/* ── Navigation arrows — overlaid, token-styled, outside the 3D space ── */}
        <NavButton side="left" onClick={prev} />
        <NavButton side="right" onClick={next} />
      </div>

      {/* ── Focused title + author, below the shelf, updating with the center ── */}
      <CaptionPlate title={focused.title} author={focused.author} live />
    </div>
  );
}

/* ── A single cover: real raster in a hairline frame, lit when focused. The
   focused frame carries the one periwinkle accent (border + glow); the rest
   stay neutral. An optional soft reflection seats it on the shelf. ──────────── */
function CoverFrame({
  book,
  focused,
  withReflection = false,
}: {
  book: CoverflowBook;
  focused: boolean;
  withReflection?: boolean;
}) {
  return (
    <div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
      <div
        className="relative h-full w-full overflow-hidden rounded-[12px] transition-[box-shadow,border-color] duration-300 ease-out"
        style={{
          border: `1px solid ${focused ? "var(--cf-recall-accent)" : "var(--cf-recall-frame)"}`,
          boxShadow: focused
            ? "0 40px 90px -40px var(--cf-recall-glow), 0 0 0 1px var(--cf-recall-accent-line)"
            : "0 28px 64px -44px var(--cf-recall-plate-deep)",
        }}
      >
        <Image
          src={book.src}
          alt={`${book.title}${book.author ? ` by ${book.author}` : ""}`}
          fill
          sizes="(max-width: 640px) 60vw, (max-width: 1024px) 34vw, 23vw"
          className="object-cover"
          draggable={false}
        />
        {/* A whisper of inner shading on non-focused covers so the angled ones
            read as receding into shadow (token-only, pointer-events-none). */}
        {!focused && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, var(--cf-recall-vignette) 0%, transparent 55%)",
            }}
          />
        )}
      </div>

      {/* Soft reflection seated under the cover — only under the upright/forward
          covers (3D space), fades out fast. Pure token gradient, no image clone
          (cheap, CLS-safe, compositor-friendly). */}
      {withReflection && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-full h-1/3 w-full rounded-b-[12px]"
          style={{
            transform: "scaleY(-1)",
            transformOrigin: "top",
            background: focused
              ? "linear-gradient(to bottom, var(--cf-recall-glow) 0%, transparent 70%)"
              : "linear-gradient(to bottom, var(--cf-recall-plate-deep) 0%, transparent 70%)",
            opacity: 0.4,
            // A mask is alpha-only — the color value is irrelevant, only its
            // opacity matters — so a token "opaque" stop fading to transparent
            // keeps us off raw black/white while doing the same fade.
            maskImage:
              "linear-gradient(to bottom, var(--cf-recall-ink), transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, var(--cf-recall-ink), transparent)",
          }}
        />
      )}
    </div>
  );
}

/* ── The caption below the shelf: focused title + author. `live` marks it as a
   polite live region so screen readers announce the focus change. ──────────── */
function CaptionPlate({
  title,
  author,
  live = false,
}: {
  title: string;
  author: string;
  live?: boolean;
}) {
  return (
    <div
      className="mt-10 text-center sm:mt-12"
      aria-live={live ? "polite" : undefined}
      aria-atomic={live ? true : undefined}
    >
      <p
        className="font-(family-name:--font-display) text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[1.5rem]"
        style={{ color: "var(--cf-recall-ink)" }}
      >
        {title}
      </p>
      {author ? (
        <p
          className="mt-1.5 font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.22em]"
          style={{ color: "var(--cf-recall-ink-faint)" }}
        >
          {author}
        </p>
      ) : null}
    </div>
  );
}

/* ── A token-styled circular nav arrow, overlaid at the shelf edge. ─────────── */
function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  const navStyle: RingStyle = {
    background: "var(--cf-recall-panel)",
    border: "1px solid var(--cf-recall-border)",
    color: "var(--cf-recall-ink-soft)",
    "--tw-ring-color": "var(--cf-recall-accent)",
    "--tw-ring-offset-color": "transparent",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous cover" : "Next cover"}
      className={`absolute top-1/2 z-[200] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur-sm transition-[transform,background-color,border-color] duration-150 ease-out hover:scale-[1.06] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4"
      }`}
      style={navStyle}
    >
      <Icon size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}

/**
 * For the reduced-motion static row: return three covers centered on `active`
 * (active in the middle), wrapping the catalog so it never renders short.
 */
function pickStaticRow(
  books: CoverflowBook[],
  active: number,
): CoverflowBook[] {
  const count = books.length;
  if (count <= 3) return books;
  const at = (i: number) => books[((i % count) + count) % count];
  return [at(active - 1), at(active), at(active + 1)];
}
