/**
 * RecallNav — a floating, centered, glassy pill nav for the RECALL landing.
 *
 * Deliberately NOT the full marketing Navbar: that component is keyed to the
 * brand cyan accent, which would put a SECOND hue on a screen whose whole point
 * is "exactly one accent." This nav uses the single periwinkle recall accent so
 * the page reads as true near-monochrome Apple-grade restraint.
 *
 * Shape: a fixed pill centered at the top, glass over the near-black canvas
 * (backdrop-blur + saturate, hairline border, soft drop shadow). Brand sits
 * left, the section links center (How it works / Library / Pricing, hidden under
 * ~820px), and Sign in + the CTA sit right. Token-only color; the pill styling
 * lives in globals.css under `.rl-nav*`.
 */

import Link from "next/link";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";

function RecallLogo() {
  return (
    <svg width={18} height={18} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M17 12L20 14L17 16"
        stroke="var(--cf-recall-accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecallNav() {
  return (
    <>
      {/* Top fade scrim — a fixed gradient mask (bg → transparent) behind the
          pill so section headings fade out as they reach the top instead of
          smearing through the blurred nav. Sits under the pill (z-49 vs z-50).
          A dedicated element (not .landing-dark::before) so it doesn't also
          paint over the portaled Library/Request dialogs. Styled in globals.css
          under .rl-nav-scrim. */}
      <div className="rl-nav-scrim" aria-hidden="true" />
      <header className="rl-nav">
      {/* Brand — mark in a glassy hairline tile, wordmark in the display face */}
      <Link href="/" className="rl-nav-brand" aria-label="ChapterFlow home">
        <span className="rl-nav-mark" aria-hidden="true">
          <RecallLogo />
        </span>
        <span
          className="font-(family-name:--font-display)"
          style={{ color: "var(--cf-recall-ink)" }}
        >
          ChapterFlow
        </span>
      </Link>

      {/* Section links — centered, hidden under ~820px (see .rl-nav-links CSS) */}
      <nav className="rl-nav-links" aria-label="Sections">
        <a className="rl-nav-link" href="#how-it-works">
          How it works
        </a>
        <a className="rl-nav-link" href="#why-it-works">
          Why it works
        </a>
        <a className="rl-nav-link" href="#library">
          Library
        </a>
        <a className="rl-nav-link" href="#pricing">
          Pricing
        </a>
      </nav>

      {/* Account actions — Sign in + the single periwinkle CTA */}
      <nav className="rl-nav-actions" aria-label="Account">
        <a
          href={AUTH_LOGIN_BOOK_URL}
          className="rl-nav-signin focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded"
          style={{
            // @ts-expect-error -- CSS custom property for the focus ring color
            "--tw-ring-color": "var(--cf-recall-accent-line)",
          }}
        >
          Sign in
        </a>
        <a
          href={AUTH_LOGIN_BOOK_URL}
          className="hidden rounded-full px-5 py-2 text-cf-label font-semibold transition-[filter,transform] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:inline-block"
          style={{
            background: "var(--cf-recall-accent)",
            color: "var(--cf-recall-bg)",
            // @ts-expect-error -- CSS custom property for the focus ring color
            "--tw-ring-color": "var(--cf-recall-accent)",
          }}
        >
          Start reading free
        </a>
      </nav>
      </header>
    </>
  );
}
