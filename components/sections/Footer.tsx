import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  AUTH_LOGIN_BOOK_URL,
  CHAPTERFLOW_NAME,
} from "@/app/_lib/chapterflow-brand";
import { CurrentYear } from "./CurrentYear";

const EXPLORE_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Why it works", href: "/#why-it-works" },
  { label: "Books", href: "/books" },
  { label: "Pricing", href: "/pricing" },
  { label: "Start free", href: AUTH_LOGIN_BOOK_URL },
] as const;

const LEGAL_LINKS = [
  { label: "Legal overview", href: "/legal" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Refunds", href: "/legal/refund" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "Copyright", href: "/legal/copyright" },
  { label: "Data rights", href: "/legal/data-rights" },
] as const;

const RESEARCH_FOUNDATIONS =
  "Ebbinghaus 1885 · Karpicke & Roediger, Science 2008 · Cepeda et al. 2006 · FSRS-5 spaced repetition";

const linkStyle = {
  color: "var(--cf-recall-ink-soft)",
  "--tw-ring-color": "var(--cf-recall-accent)",
} as CSSProperties;

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg py-2 text-cf-label font-medium underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-0 sm:py-1";

function FooterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <nav aria-label={label}>
      <p
        className="mb-2 font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.18em]"
        style={{ color: "var(--cf-recall-ink-faint)" }}
      >
        {label}
      </p>
      {children}
    </nav>
  );
}

export function Footer() {
  return (
    <footer
      className="landing-dark rl-public-footer relative"
      style={{
        background: "var(--cf-recall-bg)",
        borderTop: "1px solid var(--cf-recall-frame)",
      }}
    >
      <div className="mx-auto max-w-[72rem] px-6 py-12 sm:px-10 sm:py-14 lg:px-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)] md:gap-16">
          <div className="max-w-md">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg font-(family-name:--font-display) text-[1.125rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ ...linkStyle, color: "var(--cf-recall-ink)" }}
            >
              {CHAPTERFLOW_NAME}
            </Link>
            <p
              className="mt-3 max-w-[40ch] text-cf-body-sm leading-relaxed"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              Guided reading that makes what you read last. Read, recall, and let
              spaced review bring the ideas back until they are yours.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 sm:gap-x-12">
            <FooterGroup label="Explore">
              <ul>
                {EXPLORE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass} style={linkStyle}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterGroup>

            <FooterGroup label="Legal">
              <ul>
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass} style={linkStyle}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterGroup>

            <FooterGroup label="Support">
              <ul>
                <li>
                  <Link href="/contact" className={linkClass} style={linkStyle}>
                    Contact and support
                  </Link>
                </li>
              </ul>
            </FooterGroup>
          </div>
        </div>

        <div
          className="mt-10 border-t pt-6"
          style={{ borderColor: "var(--cf-recall-frame)" }}
        >
          <p
            className="font-(family-name:--font-mono) text-cf-caption uppercase tracking-[0.18em]"
            style={{ color: "var(--cf-recall-ink-faint)" }}
          >
            Research foundations
          </p>
          <p
            className="mt-2 max-w-4xl text-cf-label-sm leading-relaxed"
            style={{ color: "var(--cf-recall-ink-soft)" }}
          >
            {RESEARCH_FOUNDATIONS}
          </p>
        </div>

        <div
          className="mt-6 flex flex-col gap-3 border-t pt-6 text-cf-label-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: "var(--cf-recall-frame)",
            color: "var(--cf-recall-ink-faint)",
          }}
        >
          <span>
            &copy; <CurrentYear /> {CHAPTERFLOW_NAME}. All rights reserved.
          </span>
          <span>Two free books · no card required · cancel anytime</span>
        </div>
      </div>
    </footer>
  );
}
