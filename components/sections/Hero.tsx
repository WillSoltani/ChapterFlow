"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { FREE_OFFER_LABEL } from "@/lib/pricing";
import {
  CATALOG_BOOK_COUNT_DISPLAY,
  CATALOG_MEDIAN_CHAPTER_MINUTES,
} from "@/lib/catalog-stats";
import { track } from "@/lib/analytics";

/**
 * Hero — asymmetric, product-led. A bold modern-sans headline + CTA on the left;
 * the ACTUAL in-app reader (DesktopReaderShell) on the right, framed as a glowing,
 * subtly-tilted physical "console" that auto-plays the loop. This is a SHOWPIECE
 * treatment (angled, lit, bleeding the edge) — deliberately distinct from the
 * pinned signature below (where the same reader is flat and scroll-driven beside
 * the FSRS curve), so the product is shown twice in two different registers, never
 * repeated. The static headline stays the LCP element; the reader is lazy + ssr:off
 * with a dimension-matched skeleton (CLS 0).
 */

function ReaderShotSkeleton() {
  return (
    <div
      aria-hidden
      className="w-full animate-pulse overflow-hidden rounded-2xl border"
      style={{
        height: 560,
        background: "var(--cr-bg-surface-1, var(--bg-surface-1))",
        borderColor: "var(--cf-console-rim)",
        boxShadow: "var(--shadow-hero)",
      }}
    />
  );
}

const DesktopReaderShell = dynamic(
  () =>
    import("@/components/landing/reader-demo/DesktopReaderShell").then(
      (mod) => mod.DesktopReaderShell
    ),
  { ssr: false, loading: () => <ReaderShotSkeleton /> }
);

const LOOP_VERBS = ["Read", "Prove", "Keep"];

export function Hero() {
  // Honor the in-app motion toggle (html[data-motion=reduced]), not just the OS
  // query — DesktopReaderShell's own framer useReducedMotion sees only the OS one.
  // Reduced → controlled+static (no auto-advance, no inner scroll).
  const reduced = usePrefersReducedMotion();
  return (
    <section
      id="hero"
      className="relative flex min-h-[92svh] items-center overflow-hidden pt-28 pb-16 lg:pt-32 lg:pb-20"
    >
      {/* ONE contained accent glow, tucked behind the console — depth from a single
          calibrated signal, never an ambient teal wash. Tinted via --cf-glow-contained. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-6%] top-[10%] h-[620px] w-[700px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--cf-glow-contained), transparent 76%)",
          filter: "blur(18px)",
        }}
      />
      {/* faint grid, fading out, anchored top-left under the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-60"
        style={{
          maskImage: "radial-gradient(120% 100% at 20% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(120% 100% at 20% 0%, black, transparent 70%)",
          backgroundImage:
            "linear-gradient(to right, var(--cf-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--cf-grid-line) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* low-opacity grain over the whole canvas — premium-dark depth, not decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, var(--cf-grain) 0, var(--cf-grain) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "overlay",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 px-5 md:px-8 lg:grid-cols-12 lg:gap-8">
        {/* LEFT — copy */}
        <div className="lg:col-span-5">
          <p className="cf-folio" style={{ color: "var(--accent-cyan)" }}>
            Guided reading · built on retrieval science
          </p>

          <h1
            className="mt-5 font-bold"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.7rem, 5.2vw, 4.5rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: "var(--text-heading)",
            }}
          >
            Stop forgetting{" "}
            <span style={{ color: "var(--accent-cyan)" }}>what you read.</span>
          </h1>

          <p
            className="mt-6 max-w-[34ch] text-[17px] leading-[1.6] md:text-[18px]"
            style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
          >
            ChapterFlow turns every chapter into a guided loop — read it, prove it
            with a quiz, unlock the next. Built on the testing effect and an
            FSRS-5 spaced-repetition schedule, applied to the books you actually
            want to read.
          </p>

          {/* loop-verb motif (echoed in the signature's phase rail + the final CTA) */}
          <div className="mt-7 flex items-center gap-2.5" aria-hidden>
            {LOOP_VERBS.map((v, i) => (
              <div key={v} className="flex items-center gap-2.5">
                <span
                  className="cf-folio rounded-full border px-3 py-1.5"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border-default)",
                    background: "var(--bg-glass)",
                  }}
                >
                  {v}
                </span>
                {i < LOOP_VERBS.length - 1 && (
                  <span className="text-[13px]" style={{ color: "var(--accent-cyan)" }}>
                    &rarr;
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <MagneticButton className="rounded-full">
              <Link
                href={AUTH_LOGIN_BOOK_URL}
                onClick={() => track("cta_click", { source: "hero_primary" })}
                className="cta-shine inline-flex items-center rounded-full px-8 py-4 text-[16px] font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: "var(--accent-cyan)",
                  color: "var(--primary-foreground)",
                }}
              >
                Start your first chapter &rarr;
              </Link>
            </MagneticButton>
            <a
              href="#retention-engine"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-[15px] font-medium transition-colors hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
              style={{ color: "var(--text-secondary)" }}
            >
              See how it works &darr;
            </a>
          </div>

          {/* datum-strip — a single hairline-ruled row of mono spec-cells, derived
              (median minutes + count + free offer), never hardcoded. */}
          <dl
            className="mt-8 grid grid-cols-3 rounded-md border"
            style={{ borderColor: "var(--cf-grid-line)" }}
          >
            {[
              { dt: "Median chapter", dd: `~${CATALOG_MEDIAN_CHAPTER_MINUTES} min`, num: true },
              { dt: "Catalog", dd: `${CATALOG_BOOK_COUNT_DISPLAY} books`, num: true },
              { dt: "To start", dd: FREE_OFFER_LABEL, num: false },
            ].map((cell, i) => (
              <div
                key={cell.dt}
                className="flex flex-col gap-1 px-4 py-2.5"
                style={i > 0 ? { borderLeft: "1px solid var(--cf-grid-line)" } : undefined}
              >
                <dt className="cf-folio" style={{ color: "var(--text-muted)" }}>
                  {cell.dt}
                </dt>
                <dd
                  className={`cf-folio ${cell.num ? "tabular-nums" : ""}`}
                  style={{ color: "var(--text-heading)" }}
                >
                  {cell.dd}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* RIGHT — the live reader as a lit instrument console. Fixed-height window
            (clean finished object, CLS 0) + a mono caption labelling the artifact. */}
        <div className="lg:col-span-7" style={{ perspective: "2200px" }}>
          <div className="cf-hero-console transform-gpu lg:translate-x-6">
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{
                height: "min(600px, 76svh)",
                border: "1px solid var(--cf-console-rim)",
                boxShadow: "var(--shadow-hero)",
              }}
            >
              <DesktopReaderShell
                controlledPhase={reduced ? "summary" : undefined}
                autoPlay={!reduced}
              />
            </div>
            {/* console caption — labels the live artifact in mono, like a plate
                under an instrument. Visible (not aria-hidden): it tells the visitor
                this is the real product running. */}
            <p
              className="cf-folio mt-3 flex items-center gap-2"
              style={{ color: "var(--text-muted)" }}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent-cyan)" }}
              />
              Live reader · {reduced ? "the loop, paused" : "auto-playing the loop"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
